import { UnprocessableEntityException } from "@nestjs/common";

export function assertReviewAllowed(
  booking: { customerId: string | null; status: string } | null,
  actor: string,
) {
  if (
    !booking ||
    booking.customerId !== actor ||
    booking.status !== "completed"
  ) {
    throw new UnprocessableEntityException({
      code: "REVIEW_NOT_ALLOWED",
      message: "Chỉ được đánh giá đặt sân đã hoàn thành của mình.",
    });
  }
}
