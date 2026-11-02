import { BadRequestException } from "@nestjs/common";
import type { VenueStatus } from "../../../../../packages/shared/src/constants.js";
import type { VenueStatusDto } from "./dto/venue.dto.js";

/** Input is already validated/trimmed by the shared schema. No database access. */
export function moderateVenue(
  current: VenueStatus,
  reason: string | null,
  input: VenueStatusDto,
) {
  const invalid = () =>
    new BadRequestException({
      code: "INVALID_STATUS_TRANSITION",
      message: "Không thể chuyển trạng thái địa điểm theo yêu cầu.",
    });
  if (current === input.status) {
    if (current !== "rejected" || reason === input.reason)
      return { changed: false, status: current, rejectionReason: reason };
    if (reason !== null) throw invalid();
    // A legacy rejected row may receive its missing reason once.
    return { changed: true, status: current, rejectionReason: input.reason! };
  }
  const allowed =
    (current === "pending" &&
      (input.status === "approved" || input.status === "rejected")) ||
    (current === "approved" && input.status === "suspended") ||
    (current === "suspended" && input.status === "pending");
  if (!allowed) throw invalid();
  return {
    changed: true,
    status: input.status,
    rejectionReason: input.status === "rejected" ? input.reason! : null,
  };
}
