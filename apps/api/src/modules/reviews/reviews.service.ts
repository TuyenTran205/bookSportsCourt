import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { createReviewSchema } from "../../../../../packages/shared/src/schemas.js";
import {
  adminReviewQuerySchema,
  noQuerySchema,
  phase4IdSchema,
  publicReviewQuerySchema,
  reviewVisibilitySchema,
} from "../../../../../packages/shared/src/phase4-schemas.js";
import {
  reviewAdminSchema,
  reviewPublicSchema,
} from "../../../../../packages/shared/src/phase4-responses.js";
import type { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { AuthService } from "../auth/auth.service.js";
import type { AuthTransaction } from "../auth/auth.repository.js";
import { ReviewsRepository } from "./reviews.repository.js";
import { assertReviewAllowed } from "./review.rules.js";

const validate = <T extends z.ZodTypeAny>(schema: T, raw: unknown) =>
  new ZodValidationPipe(schema).transform(raw);
@Injectable()
export class ReviewsService {
  constructor(
    private readonly repo: ReviewsRepository,
    private readonly auth: AuthService,
  ) {}
  private async role(
    actor: string,
    role: "admin" | "customer",
    tx?: AuthTransaction,
  ) {
    const user = await this.auth.requireActiveUser(actor, tx);
    if (user.role !== role)
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Không có quyền thực hiện thao tác này.",
      });
  }
  private missing(): never {
    throw new NotFoundException({
      code: "NOT_FOUND",
      message: "Không tìm thấy tài nguyên.",
    });
  }
  private view(
    row: NonNullable<Awaited<ReturnType<ReviewsRepository["findReview"]>>>,
    admin: boolean,
  ) {
    const data = {
      id: row.id,
      venueId: row.venueId,
      rating: row.rating,
      comment: row.content,
      ownerReply: row.ownerReply,
      ownerRepliedAt: row.ownerRepliedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
    return admin
      ? reviewAdminSchema.parse({
          ...data,
          bookingId: row.bookingId,
          customerId: row.customerId,
          isVisible: row.isVisible,
          updatedAt: row.updatedAt.toISOString(),
        })
      : reviewPublicSchema.parse(data);
  }
  private async safe<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await work();
      } catch (error) {
        let current: unknown = error;
        let retry = false;
        const seen = new Set<unknown>();
        while (current && typeof current === "object" && !seen.has(current)) {
          seen.add(current);
          if (
            "code" in current &&
            ["40001", "40P01"].includes(String(current.code))
          )
            retry = true;
          if (
            "code" in current &&
            current.code === "23505" &&
            "constraint" in current &&
            ["reviews_booking_id_key", "uq_reviews_booking"].includes(
              String(current.constraint),
            )
          ) {
            throw new ConflictException({
              code: "ALREADY_EXISTS",
              message: "Đặt sân này đã được đánh giá.",
            });
          }
          current = "cause" in current ? current.cause : null;
        }
        if (retry && attempt < 2) continue;
        if (error instanceof HttpException) throw error;
        if (retry)
          throw new ServiceUnavailableException({
            code: "SERVICE_UNAVAILABLE",
            message: "Tài nguyên đang được cập nhật. Vui lòng thử lại.",
          });
        throw new InternalServerErrorException({
          code: "INTERNAL_ERROR",
          message: "Không thể xử lý đánh giá.",
        });
      }
    }
    throw new Error("Unreachable");
  }
  async create(actor: string, body: unknown, query: unknown) {
    await this.role(actor, "customer");
    const bookingId = validate(
      phase4IdSchema,
      body && typeof body === "object" && "bookingId" in body
        ? body.bookingId
        : undefined,
    );
    return this.safe(() =>
      this.repo.transaction(async (tx) => {
        await this.role(actor, "customer", tx);
        const lookup = await this.repo.lookupBooking(tx, bookingId);
        if (!lookup || lookup.booking.customerId !== actor)
          assertReviewAllowed(null, actor);
        const venue = await this.repo.lockVenue(tx, lookup!.court.venueId);
        const locked = await this.repo.lockBooking(
          tx,
          lookup!.court.id,
          bookingId,
        );
        if (!venue || !locked.court || !locked.booking)
          assertReviewAllowed(null, actor);
        if (
          locked.court!.venueId !== venue!.id ||
          locked.booking!.courtId !== locked.court!.id
        ) {
          throw Object.assign(new Error("Booking parent changed"), {
            code: "40001",
          });
        }
        validate(noQuerySchema, query);
        const input = validate(createReviewSchema, body);
        assertReviewAllowed(locked.booking!, actor);
        return this.view(
          await this.repo.create(tx, input, venue!.id, actor),
          true,
        );
      }),
    );
  }
  async publicList(rawId: string, raw: unknown) {
    const venueId = validate(phase4IdSchema, rawId),
      query = validate(publicReviewQuerySchema, raw);
    return this.safe(() =>
      this.repo.snapshot(async (tx) => {
        if (!(await this.repo.publicVenue(tx, venueId))) this.missing();
        return this.page(
          await this.repo.list(tx, { ...query, venueId, isVisible: true }),
          query,
          false,
        );
      }),
    );
  }
  async adminList(actor: string, raw: unknown) {
    await this.role(actor, "admin");
    const query = validate(adminReviewQuerySchema, raw);
    return this.safe(() =>
      this.repo.snapshot(async (tx) =>
        this.page(await this.repo.list(tx, query), query, true),
      ),
    );
  }
  private page(
    result: Awaited<ReturnType<ReviewsRepository["list"]>>,
    query: { page: number; limit: number },
    admin: boolean,
  ) {
    return {
      data: result.rows.map((row) => this.view(row, admin)),
      meta: {
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
        page: query.page,
        limit: query.limit,
      },
    };
  }
  async visibility(
    actor: string,
    rawId: string,
    body: unknown,
    query: unknown,
  ) {
    await this.role(actor, "admin");
    const id = validate(phase4IdSchema, rawId);
    return this.safe(() =>
      this.repo.transaction(async (tx) => {
        await this.role(actor, "admin", tx);
        const lookup = await this.repo.findReview(tx, id);
        if (!lookup) this.missing();
        const venue = await this.repo.lockVenue(tx, lookup.venueId);
        if (!venue) this.missing();
        const row = await this.repo.findReview(tx, id, true);
        if (!row) this.missing();
        if (row.venueId !== venue.id)
          throw Object.assign(new Error("Review parent changed"), {
            code: "40001",
          });
        validate(noQuerySchema, query);
        const input = validate(reviewVisibilitySchema, body);
        return this.view(
          await this.repo.visibility(tx, row, input.isVisible, actor),
          true,
        );
      }),
    );
  }

  async ownerList(
    user: AuthenticatedUser,
    query: {
      venueId?: string;
      replied?: boolean | string;
      page?: number | string;
      limit?: number | string;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const replied =
      query.replied === true || query.replied === "true"
        ? true
        : query.replied === false || query.replied === "false"
          ? false
          : undefined;

    const { rows, total } = await this.repo.ownerList(user.id, {
      venueId: query.venueId,
      replied,
      page,
      limit,
    });
    const totalPages = Math.ceil(total / limit);
    const data = rows.map((r) => ({
      id: r.id,
      venueId: r.venueId,
      venueName: r.venueName,
      courtId: r.courtId,
      courtName: r.courtName,
      customerId: r.customerId,
      customerName: r.customerName || "Khách hàng",
      rating: r.rating,
      comment: r.comment,
      content: r.comment,
      ownerReply: r.ownerReply,
      ownerRepliedAt: r.ownerRepliedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
    return { data, meta: { page, limit, total, totalPages } };
  }

  async ownerReply(user: AuthenticatedUser, reviewId: string, reply: string) {
    if (!reply || !reply.trim()) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Nội dung phản hồi không được để trống.",
      });
    }
    const result = await this.repo.ownerReply(user.id, reviewId, reply.trim());
    if (!result) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy đánh giá.",
      });
    }
    if (result === "FORBIDDEN") {
      throw new ForbiddenException({
        code: "NOT_VENUE_OWNER",
        message: "Bạn không phải chủ sở hữu của cơ sở được đánh giá.",
      });
    }
    return {
      id: result.id,
      venueId: result.venueId,
      rating: result.rating,
      comment: result.content,
      ownerReply: result.ownerReply,
      ownerRepliedAt: result.ownerRepliedAt?.toISOString() ?? null,
      createdAt: result.createdAt.toISOString(),
    };
  }
}
