import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { BookingsModule } from "../bookings/bookings.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { UploadsModule } from "../uploads/uploads.module.js";
import {
  PaymentsController,
  ProofAccessGuard,
  ProofUploadInterceptor,
} from "./payments.controller.js";
import { PaymentsRepository } from "./payments.repository.js";
import { PaymentsService } from "./payments.service.js";
import { OwnerPaymentsController } from "./owner-payments.controller.js";
import { PaymentReviewService } from "./payment-review.service.js";
import { CancelStalePaymentsSchedule } from "../../schedules/cancel-stale-payments.schedule.js";
@Module({
  imports: [AuthModule, UploadsModule, RealtimeModule, BookingsModule],
  controllers: [PaymentsController, OwnerPaymentsController],
  providers: [
    PaymentsRepository,
    PaymentsService,
    PaymentReviewService,
    CancelStalePaymentsSchedule,
    ProofAccessGuard,
    ProofUploadInterceptor,
  ],
})
export class PaymentsModule {}
