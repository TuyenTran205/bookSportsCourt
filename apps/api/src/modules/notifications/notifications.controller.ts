import {
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { NotificationsService } from "./notifications.service.js";

/**
 * Thông báo trong ứng dụng (chuông ở header).
 * Mọi route đều giới hạn theo `user.id` — không có route nào đọc dữ liệu người khác.
 */
@ApiTags("Notifications")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "[User] Danh sách thông báo của tôi" })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("unreadOnly") unreadOnly?: string,
    @Query("type") type?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.service.list({
      userId: user.id,
      unreadOnly: unreadOnly === "true",
      type,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    });
  }

  /** Badge trên header — gọi lại mỗi khi có sự kiện realtime. */
  @Get("unread-count")
  @ApiOperation({ summary: "[User] Số thông báo chưa đọc" })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.service.unreadCount(user.id);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "[User] Đánh dấu một thông báo đã đọc" })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.service.markRead(user.id, id);
  }

  @Post("read-all")
  @HttpCode(200)
  @ApiOperation({ summary: "[User] Đánh dấu tất cả đã đọc" })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.service.markAllRead(user.id);
  }
}