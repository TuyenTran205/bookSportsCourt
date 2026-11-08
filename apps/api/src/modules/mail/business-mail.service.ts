import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { createHash } from "node:crypto";
import { EmailOutboxRepository } from "./email-outbox.repository.js";
import { MailDeliveryError, MailTransport } from "./mail.transport.js";
import {
  MailEventPayload,
  mailSubjects,
  renderBookingMail,
} from "./business-mail.templates.js";

@Injectable()
export class BusinessMailService implements OnModuleInit {
  private running = false;
  private readonly logger = new Logger(BusinessMailService.name);
  constructor(
    private readonly repo: EmailOutboxRepository,
    private readonly mail: MailTransport,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    if (this.config.get<boolean>("BUSINESS_MAIL_ENABLED"))
      this.mail.assertConfigured();
  }
  async deliverOne() {
    const claimed = await this.repo.claim();
    if (!claimed) return false;
    if (claimed.parked) return true;
    let job = claimed.job;
    const payload = MailEventPayload.safeParse(job.payload);
    const view = payload.success
      ? await this.repo.view(payload.data.bookingId, payload.data.paymentId)
      : null;
    const owner = job.eventType === "payment_submitted";
    if (
      !payload.success ||
      !Object.hasOwn(mailSubjects, job.eventType) ||
      !view ||
      view.venue_id !== payload.data.venueId ||
      (payload.data.paymentId && view.payment_id !== payload.data.paymentId) ||
      job.recipientId !== (owner ? view.owner_id : view.customer_id) ||
      (owner ? view.owner_deleted : view.customer_deleted)
    ) {
      await this.repo.finish(job, "failed", "INVALID_EVENT_OR_RECIPIENT");
      return true;
    }
    if (
      job.eventType === "booking_reminder" &&
      (view.status !== "confirmed" ||
        new Date(view.start).getTime() <= Date.now())
    ) {
      await this.repo.finish(job, "failed", "REMINDER_OBSOLETE");
      return true;
    }
    const email = owner ? view.owner_email : view.email;
    // If email/ownership changes, stop rather than send a frozen request to a former recipient.
    if (
      job.emailRequest &&
      (job.emailRequest.to.length !== 1 || job.emailRequest.to[0] !== email)
    ) {
      await this.repo.finish(
        job,
        "delivery_unknown",
        "RECIPIENT_CHANGED_RECONCILE",
      );
      return true;
    }
    try {
      this.mail.assertConfigured();
      if (!job.emailRequest) {
        const frozen = await this.repo.freeze(job, {
          from: this.config.getOrThrow<string>("MAIL_FROM"),
          to: [email],
          ...renderBookingMail(job.eventType, payload.data.bookingId, {
            venueName: view.venue_name,
            courtName: view.court_name,
            start: new Date(view.start),
            end: new Date(view.end),
            totalPrice: view.total_price,
            depositAmount: view.deposit_amount,
          }),
        });
        if (!frozen) return true;
        job = frozen;
      }
      const key = createHash("sha256")
        .update(`${job.eventKey}\0email\0${job.recipientId}`)
        .digest("hex");
      await this.mail.send(job.emailRequest!, `bsc/${key}`);
    } catch (error) {
      const known = error instanceof MailDeliveryError;
      const code = known ? error.code : "DELIVERY_AMBIGUOUS";
      await this.repo.finish(
        job,
        job.attempts >= 5
          ? code === "DELIVERY_AMBIGUOUS"
            ? "delivery_unknown"
            : "failed"
          : known && !error.retryable
            ? "failed"
            : "pending",
        code,
      );
      return true;
    }
    // An acknowledgement DB failure must leave the lease recoverable, never manufacture a send failure.
    await this.repo.finish(
      job,
      "delivered",
      null,
      job.eventType === "booking_reminder" ? payload.data.bookingId : undefined,
    );
    return true;
  }
  @Interval(10000)
  async tick() {
    if (!this.config.get<boolean>("BUSINESS_MAIL_ENABLED") || this.running)
      return;
    this.running = true;
    try {
      for (let n = 0; n < 10 && (await this.deliverOne()); n++) {
        /* bounded batch */
      }
    } catch {
      this.logger.error(
        "Email worker interrupted; persisted leases will recover.",
      );
    } finally {
      this.running = false;
    }
  }
}
