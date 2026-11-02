import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { slugify } from "../../common/utils/slugify.js";
import { CatalogsRepository } from "../catalogs/catalogs.repository.js";
import { VenuesRepository } from "./venues.repository.js";
import type {
  BankAccountInput,
  CancellationPolicyInput,
  CreateVenueInput,
  UpdateVenueInput,
  VenueModerationInput,
} from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";

@Injectable()
export class VenuesService {
  constructor(
    private readonly repo: VenuesRepository,
    private readonly catalogsRepo: CatalogsRepository,
  ) {}

  private async validateArea(provinceId: string, districtId: string) {
    const [province, district] = await Promise.all([
      this.catalogsRepo.findAreaById(provinceId),
      this.catalogsRepo.findAreaById(districtId),
    ]);

    if (!province || province.type !== "province") {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Tỉnh/thành phố không hợp lệ.",
      });
    }

    if (!district || district.type !== "district" || district.parentId !== provinceId) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Quận/huyện không thuộc tỉnh/thành đã chọn.",
      });
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    let baseSlug = slugify(name);
    if (!baseSlug) baseSlug = "venue";

    let slug = baseSlug;
    let existing = await this.repo.findBySlug(slug);
    let counter = 1;

    while (existing) {
      const suffix = randomBytes(2).toString("hex");
      slug = `${baseSlug}-${suffix}`;
      existing = await this.repo.findBySlug(slug);
      counter++;
      if (counter > 10) {
        slug = `${baseSlug}-${Date.now()}`;
        break;
      }
    }

    return slug;
  }

  async createVenue(ownerId: string, input: CreateVenueInput) {
    await this.validateArea(input.provinceId, input.districtId);
    const slug = await this.generateUniqueSlug(input.name);
    return this.repo.createVenue(ownerId, slug, input);
  }

  async updateVenue(id: string, input: UpdateVenueInput) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở thể thao không tồn tại.",
      });
    }

    const provId = input.provinceId ?? existing.provinceId;
    const distId = input.districtId ?? existing.districtId;

    if (input.provinceId || input.districtId) {
      await this.validateArea(provId, distId);
    }

    return this.repo.updateVenue(id, input);
  }

  async deleteVenue(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở thể thao không tồn tại.",
      });
    }
    await this.repo.softDeleteVenue(id);
  }

  async getVenueDetails(slugOrId: string, user?: AuthenticatedUser) {
    const venue = await this.repo.findBySlugOrId(slugOrId);
    if (!venue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy cơ sở thể thao.",
      });
    }

    if (venue.status !== "approved") {
      const isOwner = user?.role === "owner" && user.id === venue.ownerId;
      const isAdmin = user?.role === "admin";
      if (!isOwner && !isAdmin) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Cơ sở thể thao chưa được duyệt hoặc đang bị tạm dừng.",
        });
      }
    }

    return venue;
  }

  async searchVenues(params: {
    q?: string;
    provinceId?: string;
    districtId?: string;
    sportId?: string;
    amenityIds?: string | string[];
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    sort?: string;
    page: number;
    limit: number;
  }) {
    let amenitiesArr: string[] | undefined;
    if (typeof params.amenityIds === "string") {
      amenitiesArr = params.amenityIds.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (Array.isArray(params.amenityIds)) {
      amenitiesArr = params.amenityIds;
    }

    const sportIds = params.sportId ? [params.sportId] : undefined;

    return this.repo.searchVenues({
      q: params.q,
      provinceId: params.provinceId,
      districtId: params.districtId,
      sportIds,
      amenityIds: amenitiesArr,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minRating: params.minRating,
      sort: params.sort,
      page: params.page,
      limit: params.limit,
    });
  }

  async getMapVenues(filters: {
    provinceId?: string;
    districtId?: string;
    sportId?: string;
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
  }) {
    const sportIds = filters.sportId ? [filters.sportId] : undefined;
    return this.repo.getMapVenues({
      provinceId: filters.provinceId,
      districtId: filters.districtId,
      sportIds,
      minLat: filters.minLat,
      maxLat: filters.maxLat,
      minLng: filters.minLng,
      maxLng: filters.maxLng,
    });
  }

  async getOwnerVenues(ownerId: string) {
    return this.repo.findOwnerVenues(ownerId);
  }

  async moderateVenue(id: string, input: VenueModerationInput) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở không tồn tại.",
      });
    }

    return this.repo.updateStatus(id, input.status);
  }

  // Policies & Payment Account
  async getCancellationPolicy(venueId: string) {
    const policy = await this.repo.getCancellationPolicy(venueId);
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
    venueId: string,
    input: CancellationPolicyInput,
  ) {
    return this.repo.upsertCancellationPolicy(venueId, input);
  }

  async getPaymentAccount(venueId: string) {
    const account = await this.repo.getPaymentAccount(venueId);
    if (!account) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở chưa thiết lập tài khoản nhận tiền.",
      });
    }
    return account;
  }

  async updatePaymentAccount(venueId: string, input: BankAccountInput) {
    return this.repo.upsertPaymentAccount(venueId, input);
  }

  // Images
  async addImage(venueId: string, url: string, sortOrder = 0) {
    return this.repo.addImage(venueId, url, sortOrder);
  }

  async reorderImages(venueId: string, imageIds: string[]) {
    return this.repo.reorderImages(venueId, imageIds);
  }

  async deleteImage(venueId: string, imageId: string) {
    const res = await this.repo.deleteImage(venueId, imageId);
    if (!res) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Ảnh không tồn tại.",
      });
    }
  }
}

