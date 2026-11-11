import { SetMetadata } from "@nestjs/common";

export type OwnershipResource = "venue" | "court";
export interface OwnershipPolicy {
  resource: OwnershipResource;
  param: string;
  allowAdmin: boolean;
}
export const OWNERSHIP_KEY = Symbol("ownership");

/** Admin bypass must be explicitly enabled AND permitted by @Roles. */
export const CheckOwnership = (
  resource: OwnershipResource,
  param = "id",
  options: { allowAdmin?: boolean } = {},
) =>
  SetMetadata(OWNERSHIP_KEY, {
    resource,
    param,
    allowAdmin: options.allowAdmin === true,
  } satisfies OwnershipPolicy);
