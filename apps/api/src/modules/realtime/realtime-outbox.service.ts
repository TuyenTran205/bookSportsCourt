import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { z } from "zod";

import { getVnDateTimeParts } from "../../common/utils/time-range.js";
import { BookingsService } from "../bookings/bookings.service.js";
import {
  RealtimeOutboxRepository,
  type RealtimeOutboxJob,
} from "./realtime-outbox.repository.js";
import { RealtimePublisher } from "./realtime.publisher.js";

const uuid = z.string().uuid();
const BookingRefPayload = z.object({
  bookingId: uuid,
  venueId: uuid,
  courtId: uuid,
});
const PaymentSubmittedPayload = z.object({
  bookingId: uuid,
  paymentId: uuid,
  venueId: uuid,
  courtId: uuid.optional(),
});
const CustomerPayload = z.object({
  bookingId: uuid,
  reason: z.string().nullish(),
  courtId: uuid.optional(),
});
const CustomerPaymentPayload = z.object({
  bookingId: uuid,
  paymentId: uuid,
  reason: z.string().nullish(),
});
const SlotRefreshPayload = z.object({
  venueId: uuid,
  courtId: uuid,
  start: z.string().datetime(),
  end: z.string().datetime(),
});

/** Số job tối đa xử lý mỗi tick để một đợt event không chiếm vòng lặp quá lâu. */
const BATCH_PER_TICK = 10;

/**
 * Payload trong `outbox_deliveries.payload` là jsonb: driver pg trả về object,
 * nhưng khi đọc qua đường khác có thể là chuỗi JSON — chuẩn hoá về object.
 */
function readPayload(job: RealtimeOutboxJob): unknown {
  const raw: unknown = job.payload;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  return raw;
}

/**
 * Consumer của transactional outbox kênh realtime: claim các sự kiện nghiệp vụ
 * đã commit (booking/payment) rồi phát qua Socket.IO tới đúng room/phòng riêng.
 * Nếu đích không xác thực hoặc payload sai schema → failed (không retry vô hạn);
 * lỗi phát tạm thời → pending với backoff 1/5/15/60 phút, replay an toàn.
 */
@Injectable()
export class RealtimeOutboxService {
  private readonly logger = new Logger(RealtimeOutboxService.name);
  private running = false;

  constructor(
    private readonly repository: RealtimeOutboxRepository,
    private readonly publisher: RealtimePublisher,
    private readonly config: ConfigService,
    @Optional()
    @Inject(BookingsService)
    private readonly bookings: BookingsService | null,
  ) {}

  @Interval(5000)
  async tick(): Promise<void> {
    if (!this.config.get<boolean>("REALTIME_OUTBOX_ENABLED") || this.running) {
      return;
    }
    this.running = true;
    try {
      for (let processed = 0; processed < BATCH_PER_TICK; processed += 1) {
        const delivered = await this.deliverOne();
        if (!delivered) break;
      }
    } catch (error) {
      this.logger.error(
        "Realtime outbox worker interrupted; lease còn hạn sẽ tự phục hồi.",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  /** Trả về true nếu có job được xử lý (để tick tiếp tục rút cạn hàng đợi). */
  async deliverOne(): Promise<boolean> {
    const claimed = await this.repository.claim();
    if (claimed === null) return false;
    if (claimed.parked) return true;
    const { job } = claimed;
    try {
      const finishedInline = await this.deliver(job);
      if (!finishedInline) {
        await this.mirrorNotification(job);
        await this.repository.finish(job, "delivered", null);
      }
    } catch (error) {
      await this.repository.finish(job, "pending", "REALTIME_DELIVERY_FAILED");
      this.logger.warn(
        `Retry job ${job.eventKey} (lần ${job.attempts}): ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
    }
    return true;
  }

  /** Trả về true nếu job đã được chốt trạng thái bên trong (failed/không hợp lệ). */
  private async deliver(job: RealtimeOutboxJob): Promise<boolean> {
    switch (job.eventType) {
      case "booking_created":
        return this.deliverBookingCreated(job);
      case "payment_submitted":
        return this.deliverOwnerScoped(job, PaymentSubmittedPayload);
      case "booking_cancelled":
        return this.deliverCustomerScoped(job);
      case "hold_expired":
        return this.deliverCustomerScoped(job);
      case "booking_confirmed":
      case "payment_rejected":
        return this.deliverCustomerPaymentScoped(job);
      case "slot_refresh_requested":
        return this.deliverSlotRefresh(job);
      default:
        await this.repository.finish(job, "failed", "INVALID_EVENT");
        return true;
    }
  }

  /** booking_created: room owner + room cá nhân khách (nếu booking có user). */
  private async deliverBookingCreated(
    job: RealtimeOutboxJob,
  ): Promise<boolean> {
    const parsed = BookingRefPayload.safeParse(readPayload(job));
    const view = parsed.success
      ? await this.repository.view(parsed.data.bookingId)
      : null;
    if (
      !parsed.success ||
      view === null ||
      view.venueId !== parsed.data.venueId ||
      view.ownerDeleted !== null ||
      job.recipientId !== view.ownerId
    ) {
      await this.repository.finish(job, "failed", "INVALID_EVENT_OR_RECIPIENT");
      return true;
    }
    const customerActive =
      view.customerId !== null && view.customerDeleted === null;
    this.publisher.emitBookingCreated(
      view.ownerId,
      customerActive ? view.customerId : null,
      {
        bookingId: parsed.data.bookingId,
        venueId: parsed.data.venueId,
        courtId: parsed.data.courtId,
      },
    );
    return false;
  }

  /** payment_submitted: chỉ room owner (owner nhận bằng chứng thanh toán). */
  private async deliverOwnerScoped(
    job: RealtimeOutboxJob,
    schema: typeof PaymentSubmittedPayload,
  ): Promise<boolean> {
    const parsed = schema.safeParse(readPayload(job));
    const view = parsed.success
      ? await this.repository.view(parsed.data.bookingId)
      : null;
    if (
      !parsed.success ||
      view === null ||
      view.venueId !== parsed.data.venueId ||
      view.ownerDeleted !== null ||
      job.recipientId !== view.ownerId
    ) {
      await this.repository.finish(job, "failed", "INVALID_EVENT_OR_RECIPIENT");
      return true;
    }
    this.publisher.emitPaymentSubmitted(view.ownerId, {
      bookingId: parsed.data.bookingId,
      paymentId: parsed.data.paymentId,
      venueId: parsed.data.venueId,
    });
    return false;
  }

  /** booking_cancelled / hold_expired: room cá nhân khách (user đã xoá → bỏ qua). */
  private async deliverCustomerScoped(
    job: RealtimeOutboxJob,
  ): Promise<boolean> {
    const parsed = CustomerPayload.safeParse(readPayload(job));
    const view = parsed.success
      ? await this.repository.view(parsed.data.bookingId)
      : null;
    if (
      !parsed.success ||
      view === null ||
      view.customerId === null ||
      view.customerId !== job.recipientId ||
      view.customerDeleted !== null
    ) {
      await this.repository.finish(job, "failed", "INVALID_EVENT_OR_RECIPIENT");
      return true;
    }
    if (job.eventType === "booking_cancelled") {
      this.publisher.emitBookingCancelled(view.customerId, {
        bookingId: parsed.data.bookingId,
        reason: parsed.data.reason ?? "UNKNOWN",
      });
    } else {
      this.publisher.emitHoldExpired(view.customerId, {
        bookingId: parsed.data.bookingId,
        courtId: parsed.data.courtId ?? "",
      });
    }
    return false;
  }

  /** booking_confirmed / payment_rejected: room cá nhân khách, kèm paymentId. */
  private async deliverCustomerPaymentScoped(
    job: RealtimeOutboxJob,
  ): Promise<boolean> {
    const parsed = CustomerPaymentPayload.safeParse(readPayload(job));
    const view = parsed.success
      ? await this.repository.view(parsed.data.bookingId)
      : null;
    if (
      !parsed.success ||
      view === null ||
      view.customerId === null ||
      view.customerId !== job.recipientId ||
      view.customerDeleted !== null
    ) {
      await this.repository.finish(job, "failed", "INVALID_EVENT_OR_RECIPIENT");
      return true;
    }
    if (job.eventType === "booking_confirmed") {
      this.publisher.emitBookingConfirmed(view.customerId, {
        paymentId: parsed.data.paymentId,
        bookingId: parsed.data.bookingId,
      });
    } else {
      this.publisher.emitPaymentRejected(view.customerId, {
        paymentId: parsed.data.paymentId,
        bookingId: parsed.data.bookingId,
        reason: parsed.data.reason ?? "UNKNOWN",
      });
    }
    return false;
  }

  /**
   * slot_refresh_requested chỉ là intent: hydrate lưới slot chính thức của
   * sân+ngày rồi phát SLOT_UPDATED vào room `venue:{id}:date:{date}`.
   */
  private async deliverSlotRefresh(
    job: RealtimeOutboxJob,
  ): Promise<boolean> {
    const parsed = SlotRefreshPayload.safeParse(readPayload(job));
    if (!parsed.success) {
      await this.repository.finish(job, "failed", "INVALID_EVENT");
      return true;
    }
    if (this.bookings === null) {
      // BookingsService chưa sẵn sàng — ném lỗi để job được thử lại ở tick sau.
      throw new Error("BOOKINGS_SERVICE_UNAVAILABLE");
    }
    const { venueId, courtId, start } = parsed.data;
    const date = getVnDateTimeParts(new Date(start)).dateStr;
    const grid = await this.bookings.getVenueSlots(venueId, { date });
    const court = grid.data.courts.find((item) => item.courtId === courtId);
    if (!court) {
      // Sân/court đã biến mất: không còn gì để refresh — coi như đã phát.
      return false;
    }
    this.publisher.emitSlots({
      venueId,
      courtId,
      date,
      slots: court.slots,
    });
    return false;
  }

  /** Mirror notification_created (nếu nghiệp vụ đã ghi notification cùng eventKey). */
  private async mirrorNotification(job: RealtimeOutboxJob): Promise<void> {
    if (job.eventType === "slot_refresh_requested") return;
    const notification = await this.repository.viewNotification(
      job.eventKey,
      job.recipientId,
    );
    if (notification) {
      this.publisher.emitNotification(job.recipientId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
      });
    }
  }
}
