import type {
  CreateVenueInput,
  UpdateVenueInput,
  VenueStatusUpdateInput,
  OwnerVenueQueryInput,
  AdminVenueQueryInput,
} from "../../../../../../packages/shared/src/schemas.js";
import type {
  ApiSuccess,
  OwnerVenueResponse,
  AdminVenueResponse,
  VenueDetail,
  PaginationMeta,
} from "../../../../../../packages/shared/src/types.js";

export type CreateVenueDto = CreateVenueInput;
export type UpdateVenueDto = UpdateVenueInput;
export type VenueStatusDto = VenueStatusUpdateInput;
export type OwnerVenueQueryDto = OwnerVenueQueryInput;
export type AdminVenueQueryDto = AdminVenueQueryInput;
export type VenueDetailResponseDto = ApiSuccess<VenueDetail>;
export type OwnerVenueResponseDto = ApiSuccess<OwnerVenueResponse>;
export type AdminVenueResponseDto = ApiSuccess<AdminVenueResponse>;
// Pagination meta is required for list responses, optional on generic ApiSuccess.
export type OwnerVenueListResponseDto = ApiSuccess<OwnerVenueResponse[]> & {
  meta: PaginationMeta;
};
export type AdminVenueListResponseDto = ApiSuccess<AdminVenueResponse[]> & {
  meta: PaginationMeta;
};
