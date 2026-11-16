import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { BookingsModule } from "../bookings/bookings.module.js";
import { RealtimeGateway } from "./realtime.gateway.js";
import { RealtimeOutboxRepository } from "./realtime-outbox.repository.js";
import { RealtimeOutboxService } from "./realtime-outbox.service.js";
import { RealtimePublisher } from "./realtime.publisher.js";

@Module({
  // ScheduleModule.forRoot() đã đăng ký toàn cục ở AppModule — @Interval hoạt động bình thường.
  imports: [AuthModule, BookingsModule],
  providers: [
    RealtimeGateway,
    RealtimePublisher,
    RealtimeOutboxRepository,
    RealtimeOutboxService,
  ],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}