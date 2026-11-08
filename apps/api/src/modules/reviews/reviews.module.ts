import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ReviewsController } from "./reviews.controller.js";
import { ReviewsRepository } from "./reviews.repository.js";
import { ReviewsService } from "./reviews.service.js";

@Module({
  imports: [AuthModule],
  controllers: [ReviewsController],
  providers: [ReviewsRepository, ReviewsService],
})
export class ReviewsModule {}
