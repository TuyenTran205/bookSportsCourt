import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants.js";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedUser } from "../../../packages/shared/src/types.js";
import { Roles, ROLES_KEY } from "../src/common/decorators/roles.decorator.js";
import { CurrentUser } from "../src/common/decorators/current-user.decorator.js";
import {
  CheckOwnership,
  OWNERSHIP_KEY,
  type OwnershipPolicy,
} from "../src/common/decorators/check-ownership.decorator.js";

@Roles("owner")
class DecoratorController {
  @Roles("customer")
  customer() {}

  @Roles()
  denied() {}

  @CheckOwnership("venue")
  venue() {}

  @CheckOwnership("court", "courtId")
  court() {}

  @CheckOwnership("venue", "venueId", { allowAdmin: true })
  adminVenue() {}

  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}

test("Roles records explicit roles and method metadata overrides controller metadata", () => {
  const reflector = new Reflector();
  assert.deepEqual(reflector.get(ROLES_KEY, DecoratorController), ["owner"]);
  assert.deepEqual(
    reflector.getAllAndOverride(ROLES_KEY, [
      DecoratorController.prototype.customer,
      DecoratorController,
    ]),
    ["customer"],
  );
  assert.deepEqual(
    reflector.getAllAndOverride(ROLES_KEY, [
      DecoratorController.prototype.denied,
      DecoratorController,
    ]),
    [],
  );
  assert.equal(
    reflector.get(ROLES_KEY, DecoratorController.prototype.me),
    undefined,
  );
});

test("CheckOwnership preserves route parameter names and requires explicit admin opt-in", () => {
  const reflector = new Reflector();
  for (const [handler, expected] of [
    [
      DecoratorController.prototype.venue,
      { resource: "venue", param: "id", allowAdmin: false },
    ],
    [
      DecoratorController.prototype.court,
      { resource: "court", param: "courtId", allowAdmin: false },
    ],
    [
      DecoratorController.prototype.adminVenue,
      { resource: "venue", param: "venueId", allowAdmin: true },
    ],
  ] as const) {
    assert.deepEqual(
      reflector.get<OwnershipPolicy>(OWNERSHIP_KEY, handler),
      expected,
    );
    assert.equal(reflector.get(ROLES_KEY, handler), undefined);
  }
});

// Read the factory registered by Nest so the real parameter decorator is exercised.
function currentUser(request: object): AuthenticatedUser {
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    DecoratorController,
    "me",
  ) as Record<
    string,
    {
      factory: (data: unknown, context: ExecutionContext) => AuthenticatedUser;
      data: unknown;
    }
  >;
  const entries = Object.values(metadata);
  assert.equal(entries.length, 1);
  const entry = entries[0]!;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  return entry.factory(entry.data, context);
}

test("CurrentUser returns the request principal without trusting body identity or role", () => {
  const user: AuthenticatedUser = {
    id: "verified-user",
    email: "decorator@example.test",
    fullName: "Decorator test",
    phone: null,
    avatarUrl: null,
    role: "customer",
    status: "active",
    createdAt: "2026-10-28T00:00:00.000Z",
    updatedAt: "2026-10-28T00:00:00.000Z",
    emailVerifiedAt: null,
  };
  assert.equal(
    currentUser({
      user,
      body: { id: "forged-user", role: "admin", user: { role: "admin" } },
    }),
    user,
  );
});

test("CurrentUser rejects a missing principal even when the body contains a user", () => {
  for (const request of [
    {},
    { body: { user: { id: "forged-user", role: "admin" } } },
  ]) {
    assert.throws(
      () => currentUser(request),
      (error: unknown) =>
        error instanceof UnauthorizedException && error.getStatus() === 401,
    );
  }
});
