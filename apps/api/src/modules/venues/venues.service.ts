import type {
  PublicVenueSearchQueryInput,
  VenueMapQueryInput,
} from "../../../../../packages/shared/src/schemas.js";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { v7 } from "uuid";
import { z } from "zod";
import {
  VENUE_STATUSES,
  COURT_STATUSES,
} from "../../../../../packages/shared/src/constants.js";
import type { VenueDetail } from "../../../../../packages/shared/src/types.js";
import type {
  OwnerVenueQueryDto,
  AdminVenueQueryDto,
} from "./dto/venue.dto.js";
import type { OwnerVenueResponse } from "../../../../../packages/shared/src/types.js";
import { AuthService } from "../auth/auth.service.js";
import type { CreateVenueDto } from "./dto/venue.dto.js";
import { VenuesRepository } from "./venues.repository.js";
import { venueSlug } from "./venue-slug.js";
import { OwnershipService } from "../auth/ownership.service.js";
import type { AuthTransaction } from "../auth/auth.repository.js";
import type { UpdateVenueDto } from "./dto/venue.dto.js";
import { uuidSchema } from "../../../../../packages/shared/src/schemas.js";
import { venueStatusUpdateSchema } from "../../../../../packages/shared/src/schemas.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { moderateVenue } from "./venue-moderation.js";
import type {
  BankAccountInput,
  CancellationPolicyInput,
} from "../../../../../packages/shared/src/schemas.js";

function invalid(message: string) {
  return new BadRequestException({ code: "VALIDATION_ERROR", message });
}

// Drizzle wraps PostgreSQL errors in cause. Never expose the query or parameters.
function databaseCode(error: unknown): string | undefined {
  const seen = new Set<object>();
  while (error && typeof error === "object" && !seen.has(error)) {
    seen.add(error);
    if ("code" in error && typeof error.code === "string") return error.code;
    error = "cause" in error ? error.cause : undefined;
  }
  return undefined;
}

@Injectable()
export class VenuesService {
  constructor(
    private readonly repository: VenuesRepository,
    private readonly auth: AuthService,
    private readonly ownership: OwnershipService,
  ) {}

  async moderate(
    userId: string,
    id: string,
    body: unknown,
  ): Promise<OwnerVenueResponse> {
    return this.repository.transaction(async (tx) => {
      const user = await this.auth.requireActiveUser(userId, tx);
      if (user.role !== "admin")
        throw new ForbiddenException({
          code: "FORBIDDEN",
          message: "Chỉ Admin được kiểm duyệt địa điểm.",
        });
      if (!uuidSchema.safeParse(id).success)
        throw invalid("ID địa điểm không hợp lệ.");
      const venue = await this.repository.lockVenue(tx, id);
      if (!venue)
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Không tìm thấy địa điểm.",
        });
      // Contract: auth/role -> UUID/live resource -> body -> transition.
      const input = new ZodValidationPipe(venueStatusUpdateSchema).transform(
        body,
      );
      const decision = moderateVenue(
        z.enum(VENUE_STATUSES).parse(venue.status),
        venue.rejectionReason,
        input,
      );
      const updated = decision.changed
        ? await this.repository.update(tx, venue.id, {
            status: decision.status,
            rejectionReason: decision.rejectionReason,
            updatedAt: new Date(),
          })
        : venue;
      if (decision.changed)
        await this.repository.auditModeration(
          tx,
          user.id,
          venue.id,
          venue,
          updated,
        );
      const links = await this.repository.links(tx, venue.id);
      return {
        id: updated.id,
        ownerId: updated.ownerId,
        slug: updated.slug,
        name: updated.name,
        description: updated.description,
        address: updated.address,
        provinceId: updated.provinceId,
        districtId: updated.districtId,
        lat: updated.lat === null ? null : Number(updated.lat),
        lng: updated.lng === null ? null : Number(updated.lng),
        ...links,
        status: z.enum(VENUE_STATUSES).parse(updated.status),
        rejectionReason: updated.rejectionReason,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  private async lockOwnedVenue(
    tx: AuthTransaction,
    userId: string,
    id: string,
  ) {
    const user = await this.auth.requireActiveUser(userId, tx);
    if (user.role !== "owner")
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Chỉ Owner được sửa địa điểm.",
      });
    if (!uuidSchema.safeParse(id).success)
      throw invalid("ID địa điểm không hợp lệ.");
    // Lock UPDATE before assertOwnership's SHARE, never upgrade competing SHARE locks.
    const venue = await this.repository.lockVenue(tx, id);
    if (!venue)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy địa điểm.",
      });
    await this.ownership.assertOwnership(
      userId,
      id,
      { resource: "venue", param: "id", allowAdmin: false },
      ["owner"],
      tx,
    );
    return venue;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateVenueDto,
  ): Promise<OwnerVenueResponse> {
    try {
      return await this.repository.transaction(async (tx) => {
        const venue = await this.lockOwnedVenue(tx, userId, id);
        const previous = await this.repository.links(tx, venue.id);
        const unique = (ids: string[]) =>
          [...new Set(ids.map((value) => value.toLowerCase()))].sort();
        const sportIds =
          input.sportIds === undefined
            ? previous.sportIds
            : unique(input.sportIds);
        const amenityIds =
          input.amenityIds === undefined
            ? previous.amenityIds
            : unique(input.amenityIds);
        const values = {
          name: input.name ?? venue.name,
          address: input.address ?? venue.address,
          description: input.description ?? venue.description,
          provinceId: input.provinceId?.toLowerCase() ?? venue.provinceId,
          districtId: input.districtId?.toLowerCase() ?? venue.districtId,
          lat:
            input.lat === undefined
              ? venue.lat
              : Number(input.lat.toFixed(7)).toFixed(7),
          lng:
            input.lng === undefined
              ? venue.lng
              : Number(input.lng.toFixed(7)).toFixed(7),
        };
        const areas = await this.repository.areas(tx, [
          values.provinceId,
          values.districtId,
        ]);
        const province = areas.find((area) => area.id === values.provinceId);
        const district = areas.find((area) => area.id === values.districtId);
        if (
          province?.type !== "province" ||
          district?.type !== "district" ||
          district.parentId !== values.provinceId
        )
          throw invalid("Tỉnh/quận không hợp lệ hoặc quận không thuộc tỉnh.");
        if (
          (await this.repository.catalogIds(tx, "sports", sportIds)).length !==
          sportIds.length
        )
          throw invalid("Môn thể thao không tồn tại.");
        if (
          (await this.repository.catalogIds(tx, "amenities", amenityIds))
            .length !== amenityIds.length
        )
          throw invalid("Tiện ích không tồn tại.");
        const sportsChanged =
          JSON.stringify(sportIds) !== JSON.stringify(previous.sportIds);
        const amenitiesChanged =
          JSON.stringify(amenityIds) !== JSON.stringify(previous.amenityIds);
        const scalarChanged = (
          Object.keys(values) as Array<keyof typeof values>
        ).some((key) => values[key] !== venue[key]);
        const changed = scalarChanged || sportsChanged || amenitiesChanged;
        const needsReview =
          changed &&
          (venue.status === "approved" || venue.status === "rejected");
        const updated = changed
          ? await this.repository.update(
              tx,
              venue.id,
              {
                ...values,
                status: needsReview ? "pending" : venue.status,
                rejectionReason: needsReview ? null : venue.rejectionReason,
                updatedAt: new Date(),
              },
              sportsChanged ? sportIds : undefined,
              amenitiesChanged ? amenityIds : undefined,
            )
          : venue;
        return {
          id: updated.id,
          ownerId: updated.ownerId,
          slug: updated.slug,
          name: updated.name,
          description: updated.description,
          address: updated.address,
          provinceId: updated.provinceId,
          districtId: updated.districtId,
          lat: updated.lat === null ? null : Number(updated.lat),
          lng: updated.lng === null ? null : Number(updated.lng),
          sportIds,
          amenityIds,
          status: z.enum(VENUE_STATUSES).parse(updated.status),
          rejectionReason: updated.rejectionReason,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };
      });
    } catch (error) {
      const code = databaseCode(error);
      if (code === "23505")
        throw new ConflictException({
          code: "ALREADY_EXISTS",
          message: "Địa điểm hoặc liên kết đã tồn tại.",
        });
      if (code === "23503" || code === "23514")
        throw invalid("Dữ liệu địa điểm hoặc danh mục không hợp lệ.");
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.repository.transaction(async (tx) => {
      const venue = await this.lockOwnedVenue(tx, userId, id);
      if (await this.repository.hasBlockingBookings(tx, venue.id))
        throw new ConflictException({
          code: "RESOURCE_IN_USE",
          message: "Địa điểm còn booking đang hoạt động.",
        });
      const now = new Date();
      await this.repository.update(tx, venue.id, {
        deletedAt: now,
        updatedAt: now,
      });
    });
  }

  async list(query: OwnerVenueQueryDto | AdminVenueQueryDto, ownerId?: string) {
    const result = await this.repository.list(query, ownerId);
    const data: OwnerVenueResponse[] = result.rows.map((venue) => ({
      id: venue.id,
      ownerId: venue.ownerId,
      slug: venue.slug,
      name: venue.name,
      description: venue.description,
      address: venue.address,
      provinceId: venue.provinceId,
      districtId: venue.districtId,
      lat: venue.lat === null ? null : Number(venue.lat),
      lng: venue.lng === null ? null : Number(venue.lng),
      sportIds: result.sports
        .filter((link) => link.venueId === venue.id)
        .map((link) => link.sportId),
      amenityIds: result.amenities
        .filter((link) => link.venueId === venue.id)
        .map((link) => link.amenityId),
      status: z.enum(VENUE_STATUSES).parse(venue.status),
      rejectionReason: venue.rejectionReason,
      createdAt: venue.createdAt.toISOString(),
      updatedAt: venue.updatedAt.toISOString(),
    }));
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  async publicDetail(identifier: string): Promise<VenueDetail> {
    const result = await this.repository.publicDetail(
      identifier,
      z.string().uuid().safeParse(identifier).success,
    );
    if (!result)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy địa điểm.",
      });
    const { venue } = result;
    const province = result.areaRows.find(
      (area) => area.id === venue.provinceId,
    );
    const district = result.areaRows.find(
      (area) => area.id === venue.districtId,
    );
    return {
      id: venue.id,
      ownerId: venue.ownerId,
      name: venue.name,
      slug: venue.slug,
      description: venue.description,
      address: venue.address,
      provinceId: venue.provinceId,
      districtId: venue.districtId,
      province: province
        ? { id: province.id, name: province.name, slug: province.slug }
        : null,
      district: district
        ? {
            id: district.id,
            name: district.name,
            slug: district.slug,
            provinceId: venue.provinceId,
          }
        : null,
      lat: venue.lat === null ? null : Number(venue.lat),
      lng: venue.lng === null ? null : Number(venue.lng),
      status: "approved",
      coverUrl: venue.coverUrl,
      ratingAvg: Number(venue.ratingAvg),
      reviewCount: venue.reviewCount,
      fromPrice: venue.fromPrice,
      sports: result.sports,
      amenities: result.amenities,
      images: result.images,
      courts: result.courts.map((court) => ({
        ...court,
        status: z.enum(COURT_STATUSES).parse(court.status),
      })),
      cancellationPolicy: result.policy ?? null,
    };
  }

  async create(
    userId: string,
    input: CreateVenueDto,
  ): Promise<OwnerVenueResponse> {
    const sportIds = [
      ...new Set(input.sportIds.map((id) => id.toLowerCase())),
    ].sort();
    const amenityIds = [
      ...new Set(input.amenityIds.map((id) => id.toLowerCase())),
    ].sort();
    const provinceId = input.provinceId.toLowerCase();
    // `districtId` là optional trong schema dùng chung (giữ tương thích mô hình 2 cấp),
    // nhưng luồng tạo cơ sở của API vẫn bắt buộc có quận/huyện.
    if (!input.districtId)
      throw invalid("Vui lòng chọn quận/huyện cho cơ sở.");
    const districtId = input.districtId.toLowerCase();
    try {
      return await this.repository.transaction(async (tx) => {
        // The guard ran before this transaction; lock and check the current DB state again.
        const user = await this.auth.requireActiveUser(userId, tx);
        if (user.role !== "owner")
          throw new ForbiddenException({
            code: "FORBIDDEN",
            message: "Chỉ Owner được tạo địa điểm.",
          });
        const rows = await this.repository.areas(tx, [provinceId, districtId]);
        const province = rows.find((area) => area.id === provinceId);
        const district = rows.find((area) => area.id === districtId);
        if (
          province?.type !== "province" ||
          district?.type !== "district" ||
          district.parentId !== provinceId
        ) {
          throw invalid("Tỉnh/quận không hợp lệ hoặc quận không thuộc tỉnh.");
        }
        if (
          (await this.repository.catalogIds(tx, "sports", sportIds)).length !==
          sportIds.length
        )
          throw invalid("Môn thể thao không tồn tại.");
        if (
          (await this.repository.catalogIds(tx, "amenities", amenityIds))
            .length !== amenityIds.length
        )
          throw invalid("Tiện ích không tồn tại.");
        const id = v7();
        const venue = await this.repository.create(
          tx,
          {
            id,
            ownerId: user.id,
            slug: venueSlug(input.name, id),
            name: input.name,
            address: input.address,
            description: input.description ?? null,
            provinceId,
            districtId,
            lat: input.lat.toFixed(7),
            lng: input.lng.toFixed(7),
            status: "pending",
            rejectionReason: null,
          },
          sportIds,
          amenityIds,
        );
        return {
          id: venue.id,
          ownerId: venue.ownerId,
          slug: venue.slug,
          name: venue.name,
          description: venue.description,
          address: venue.address,
          provinceId: venue.provinceId,
          districtId: venue.districtId,
          lat: venue.lat === null ? null : Number(venue.lat),
          lng: venue.lng === null ? null : Number(venue.lng),
          sportIds,
          amenityIds,
          status: "pending",
          rejectionReason: venue.rejectionReason,
          createdAt: venue.createdAt.toISOString(),
          updatedAt: venue.updatedAt.toISOString(),
        };
      });
    } catch (error) {
      const code = databaseCode(error);
      if (code === "23505")
        throw new ConflictException({
          code: "ALREADY_EXISTS",
          message: "Địa điểm hoặc liên kết đã tồn tại.",
        });
      if (code === "23503" || code === "23514")
        throw invalid("Dữ liệu địa điểm hoặc danh mục không hợp lệ.");
      throw error;
    }
  }
  async searchVenues(params: PublicVenueSearchQueryInput) {
    return this.repository.searchVenues({
      ...params,
      sportIds:
        params.sportIds ?? (params.sportId ? [params.sportId] : undefined),
    });
  }

  async getMapVenues(filters: VenueMapQueryInput) {
    const rows = await this.repository.getMapVenues({
      ...filters,
      sportIds: filters.sportId ? [filters.sportId] : undefined,
    });
    return rows.map((row) => ({
      ...row,
      lat: Number(row.lat),
      lng: Number(row.lng),
      ratingAvg: Number(row.ratingAvg),
    }));
  }

  async getCancellationPolicy(venueId: string) {
    const policy = await this.repository.getCancellationPolicy(venueId);
    if (!policy) {
      return {
        venueId,
        cancelBeforeHours: 24,
        refundPercent: 100,
        depositPercent: 100,
      };
    }
    return policy;
  }

  async updateCancellationPolicy(
    userId: string,
    venueId: string,
    input: CancellationPolicyInput,
  ) {
    return this.repository.transaction(async (tx) => {
      await this.lockOwnedVenue(tx, userId, venueId);
      return this.repository.upsertCancellationPolicy(venueId, input, tx);
    });
  }

  async getPaymentAccount(venueId: string) {
    const account = await this.repository.getPaymentAccount(venueId);
    return account
      ? {
          bankBin: account.bankBin,
          accountNo: account.accountNo,
          accountName: account.accountName,
        }
      : null;
  }

  async updatePaymentAccount(
    userId: string,
    venueId: string,
    input: BankAccountInput,
  ) {
    return this.repository.transaction(async (tx) => {
      await this.lockOwnedVenue(tx, userId, venueId);
      const account = await this.repository.upsertPaymentAccount(
        venueId,
        input,
        tx,
      );
      return {
        bankBin: account!.bankBin,
        accountNo: account!.accountNo,
        accountName: account!.accountName,
      };
    });
  }

  async addImage(userId: string, venueId: string, url: string, sortOrder = 0) {
    return this.repository.transaction(async (tx) => {
      const venue = await this.lockOwnedVenue(tx, userId, venueId);
      const image = await this.repository.addImage(venueId, url, sortOrder, tx);
      await this.imageContentChanged(tx, venue);
      return image;
    });
  }

  async reorderImages(userId: string, venueId: string, imageIds: string[]) {
    return this.repository.transaction(async (tx) => {
      const venue = await this.lockOwnedVenue(tx, userId, venueId);
      const before = await this.repository.imageList(venueId, tx);
      const ids = imageIds.map((id) => id.toLowerCase());
      if (
        new Set(ids).size !== ids.length ||
        ids.length !== before.length ||
        ids.some((id) => !before.some((image) => image.id === id))
      )
        throw invalid(
          "Danh sách ảnh phải gồm toàn bộ ảnh của cơ sở, không lặp ID.",
        );
      if (
        before.every(
          (image, index) =>
            image.id === ids[index] && image.sortOrder === index,
        )
      )
        return before;
      const images = await this.repository.reorderImages(venueId, ids, tx);
      await this.imageContentChanged(tx, venue);
      return images;
    });
  }

  async deleteImage(userId: string, venueId: string, imageId: string) {
    if (!uuidSchema.safeParse(imageId).success)
      throw invalid("ID ảnh không hợp lệ.");
    return this.repository.transaction(async (tx) => {
      const venue = await this.lockOwnedVenue(tx, userId, venueId);
      const image = await this.repository.deleteImage(venueId, imageId, tx);
      if (!image)
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Ảnh không tồn tại.",
        });
      if (venue.coverUrl === image.url) {
        const images = await this.repository.imageList(venueId, tx);
        await this.repository.update(tx, venueId, {
          coverUrl: images[0]?.url ?? null,
        });
      }
      await this.imageContentChanged(tx, venue);
    });
  }
  private async imageContentChanged(
    tx: AuthTransaction,
    venue: NonNullable<Awaited<ReturnType<VenuesRepository["lockVenue"]>>>,
  ) {
    await this.repository.update(tx, venue.id, {
      updatedAt: new Date(),
      ...(venue.status === "approved" || venue.status === "rejected"
        ? { status: "pending", rejectionReason: null }
        : {}),
    });
  }
}
