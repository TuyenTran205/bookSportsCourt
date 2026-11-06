import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OwnerApplicationsRepository } from "./owner-applications.repository.js";
import type {
  OwnerApplicationInput,
  UpdateOwnerApplicationStatusInput,
} from "../../../../../packages/shared/src/schemas.js";

@Injectable()
export class OwnerApplicationsService {
  constructor(private readonly repo: OwnerApplicationsRepository) {}

  async apply(userId: string, userRole: string, input: OwnerApplicationInput) {
    if (userRole === "owner" || userRole === "admin") {
      throw new ConflictException({
        code: "ALREADY_EXISTS",
        message: "Tài khoản của bạn đã là chủ sân hoặc quản trị viên.",
      });
    }

    const pending = await this.repo.findPendingByUserId(userId);
    if (pending) {
      throw new ConflictException({
        code: "ALREADY_EXISTS",
        message: "Bạn đã có hồ sơ đăng ký chủ sân đang chờ xét duyệt.",
      });
    }

    return this.repo.create(userId, input);
  }

  async getMyApplication(userId: string) {
    const app = await this.repo.findLatestByUserId(userId);
    if (!app) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Chưa có hồ sơ đăng ký chủ sân nào.",
      });
    }
    return app;
  }

  async list(options: { status?: string; page: number; limit: number }) {
    return this.repo.list(options);
  }

  async review(
    id: string,
    adminId: string,
    input: UpdateOwnerApplicationStatusInput,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Hồ sơ không tồn tại.",
      });
    }

    if (existing.status !== "pending") {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: `Hồ sơ đã ở trạng thái ${existing.status}, không thể duyệt lại.`,
      });
    }

    if (input.status === "approved") {
      return this.repo.updateStatusApproved(id, adminId, input.reviewNote);
    } else {
      return this.repo.updateStatusRejected(id, adminId, input.reviewNote);
    }
  }
}
