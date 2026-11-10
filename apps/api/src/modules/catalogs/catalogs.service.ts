import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CatalogsRepository } from "./catalogs.repository.js";
import { slugify } from "../../../../../packages/shared/src/utils/unaccent.js";
import type {
  AreaInput,
  SportInput,
} from "../../../../../packages/shared/src/schemas.js";

@Injectable()
export class CatalogsService {
  constructor(private readonly repo: CatalogsRepository) {}

  // Sports
  async getSports() {
    return this.repo.findAllSports();
  }

  async createSport(input: SportInput) {
    const slug = input.slug || slugify(input.name);
    const existing = await this.repo.findSportBySlug(slug);
    if (existing) {
      throw new ConflictException({
        code: "ALREADY_EXISTS",
        message: "Môn thể thao với slug này đã tồn tại.",
      });
    }
    return this.repo.createSport({ ...input, slug });
  }

  async updateSport(id: string, input: Partial<SportInput>) {
    const existing = await this.repo.findSportById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Môn thể thao không tồn tại.",
      });
    }
    if (input.slug && input.slug !== existing.slug) {
      const slugExists = await this.repo.findSportBySlug(input.slug);
      if (slugExists) {
        throw new ConflictException({
          code: "ALREADY_EXISTS",
          message: "Slug môn thể thao đã tồn tại.",
        });
      }
    }
    return this.repo.updateSport(id, input);
  }

  async deleteSport(id: string) {
    const existing = await this.repo.findSportById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Môn thể thao không tồn tại.",
      });
    }
    const inUse = await this.repo.isSportInUse(id);
    if (inUse) {
      throw new ConflictException({
        code: "RESOURCE_IN_USE",
        message: "Môn thể thao đang được sử dụng bởi cơ sở hoặc sân.",
      });
    }
    await this.repo.deleteSport(id);
  }

  // Amenities
  async getAmenities() {
    return this.repo.findAllAmenities();
  }

  async createAmenity(input: SportInput) {
    const slug = input.slug || slugify(input.name);
    const existing = await this.repo.findAmenityBySlug(slug);
    if (existing) {
      throw new ConflictException({
        code: "ALREADY_EXISTS",
        message: "Tiện ích với slug này đã tồn tại.",
      });
    }
    return this.repo.createAmenity({ ...input, slug });
  }

  async updateAmenity(id: string, input: Partial<SportInput>) {
    const existing = await this.repo.findAmenityById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Tiện ích không tồn tại.",
      });
    }
    if (input.slug && input.slug !== existing.slug) {
      const slugExists = await this.repo.findAmenityBySlug(input.slug);
      if (slugExists) {
        throw new ConflictException({
          code: "ALREADY_EXISTS",
          message: "Slug tiện ích đã tồn tại.",
        });
      }
    }
    return this.repo.updateAmenity(id, input);
  }

  async deleteAmenity(id: string) {
    const existing = await this.repo.findAmenityById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Tiện ích không tồn tại.",
      });
    }
    const inUse = await this.repo.isAmenityInUse(id);
    if (inUse) {
      throw new ConflictException({
        code: "RESOURCE_IN_USE",
        message: "Tiện ích đang được sử dụng bởi cơ sở.",
      });
    }
    await this.repo.deleteAmenity(id);
  }

  // Areas
  async getAreas(filters?: { type?: string; parentId?: string | null }) {
    return this.repo.findAllAreas(filters);
  }

  async createArea(input: AreaInput) {
    if (input.type === "district") {
      if (!input.parentId) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Quận/huyện bắt buộc phải có tỉnh/thành trực thuộc (parentId).",
        });
      }
      const parent = await this.repo.findAreaById(input.parentId);
      if (!parent || parent.type !== "province") {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Tỉnh/thành trực thuộc không hợp lệ.",
        });
      }
    } else if (input.type === "province") {
      input.parentId = null;
    }

    const existing = await this.repo.findAreaBySlug(input.slug, input.parentId ?? null);
    if (existing) {
      throw new ConflictException({
        code: "ALREADY_EXISTS",
        message: "Khu vực với slug này đã tồn tại trong cùng cấp.",
      });
    }
    return this.repo.createArea(input);
  }

  async updateArea(id: string, input: Partial<AreaInput>) {
    const existing = await this.repo.findAreaById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Khu vực không tồn tại.",
      });
    }

    const newType = input.type ?? existing.type;
    const newParentId = input.parentId !== undefined ? input.parentId : existing.parentId;

    if (newType === "district" && !newParentId) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Quận/huyện bắt buộc phải có tỉnh/thành trực thuộc.",
      });
    }

    if (input.slug && (input.slug !== existing.slug || newParentId !== existing.parentId)) {
      const slugExists = await this.repo.findAreaBySlug(input.slug, newParentId ?? null);
      if (slugExists && slugExists.id !== id) {
        throw new ConflictException({
          code: "ALREADY_EXISTS",
          message: "Slug khu vực đã tồn tại trong cùng cấp.",
        });
      }
    }
    return this.repo.updateArea(id, input);
  }

  async deleteArea(id: string) {
    const existing = await this.repo.findAreaById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Khu vực không tồn tại.",
      });
    }
    const inUse = await this.repo.isAreaInUse(id);
    if (inUse) {
      throw new ConflictException({
        code: "RESOURCE_IN_USE",
        message: "Khu vực đang được sử dụng bởi cơ sở hoặc có quận/huyện trực thuộc.",
      });
    }
    await this.repo.deleteArea(id);
  }

  // ===== Provinces & Wards (ĐVHC 2 cấp) =====

  async getProvinces() {
    return this.repo.findAllProvinces();
  }

  async getWardsByProvince(
    codeOrId: string,
    options?: { q?: string; limit?: number },
  ) {
    const province = await this.repo.findProvinceByCodeOrId(codeOrId);
    if (!province) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy tỉnh/thành phố.",
      });
    }
    return this.repo.findWardsByProvince(
      province.id,
      province.code ?? "",
      options,
    );
  }

  async searchWards(options: {
    q: string;
    provinceCode?: string;
    limit?: number;
  }) {
    let provinceId: string | undefined;
    if (options.provinceCode) {
      const province = await this.repo.findProvinceByCodeOrId(
        options.provinceCode,
      );
      provinceId = province?.id;
    }
    return this.repo.searchWards({
      q: options.q,
      provinceId,
      limit: options.limit,
    });
  }

  async getDistrictsByProvince(provinceId: string) {
    return this.repo.findDistrictsByProvince(provinceId);
  }
}
