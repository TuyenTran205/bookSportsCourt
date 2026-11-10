import {
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  @Get("unread-count")
  getUnreadCount() {
    return { count: 0 };
  }

  @Get()
  list() {
    return {
      data: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };
  }

  @Patch(":id/read")
  markAsRead() {
    return { success: true };
  }

  @Post("read-all")
  markAllAsRead() {
    return { success: true };
  }
}
