import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  USER_ROLES,
  type UserRole,
} from "../../../packages/shared/src/constants.js";
import type { AuthenticatedUser } from "../../../packages/shared/src/types.js";
import { Roles } from "../src/common/decorators/roles.decorator.js";
import { RolesGuard } from "../src/common/guards/roles.guard.js";

@Roles("owner")
class OwnerController {
  inherited() {}
  @Roles("customer")
  customer() {}
  @Roles("owner", "admin")
  shared() {}
  @Roles()
  denied() {}
}

class NoRolesController {
  unrestricted() {}
  @Roles("admin")
  admin() {}
}

@Roles()
class DeniedController {
  inherited() {}
  @Roles("customer")
  customer() {}
}

const guard = new RolesGuard(new Reflector());
function principal(role: UserRole): AuthenticatedUser {
  return {
    id: "test-user",
    email: "roles@example.test",
    fullName: "Roles test",
    phone: null,
    avatarUrl: null,
    role,
    status: "active",
    createdAt: "2026-10-28T00:00:00.000Z",
    updatedAt: "2026-10-28T00:00:00.000Z",
    emailVerifiedAt: null,
  };
}

function context(
  controller: Function,
  handler: Function,
  user?: AuthenticatedUser,
) {
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        body: { role: "admin", user: principal("admin") },
        query: { role: "admin" },
        params: { role: "admin" },
      }),
    }),
  } as ExecutionContext;
}

function expectRoles(
  controller: Function,
  handler: Function,
  allowed: readonly UserRole[],
) {
  for (const role of USER_ROLES) {
    const run = () =>
      guard.canActivate(context(controller, handler, principal(role)));
    if (allowed.includes(role)) assert.equal(run(), true, role);
    else
      assert.throws(
        run,
        (error: unknown) =>
          error instanceof ForbiddenException && error.getStatus() === 403,
        role,
      );
  }
}

test("RolesGuard requires a principal even without role metadata or with forged input", () => {
  for (const [controller, handler] of [
    [NoRolesController, NoRolesController.prototype.unrestricted],
    [OwnerController, OwnerController.prototype.inherited],
    [OwnerController, OwnerController.prototype.denied],
  ]) {
    assert.throws(
      () => guard.canActivate(context(controller!, handler!)),
      (error: unknown) =>
        error instanceof UnauthorizedException && error.getStatus() === 401,
    );
  }
});

test("RolesGuard allows authenticated roles when both method and class lack metadata", () => {
  expectRoles(
    NoRolesController,
    NoRolesController.prototype.unrestricted,
    USER_ROLES,
  );
});

test("RolesGuard falls back to controller roles without an implicit admin bypass", () => {
  expectRoles(OwnerController, OwnerController.prototype.inherited, ["owner"]);
});

test("RolesGuard method roles replace rather than merge with controller roles", () => {
  expectRoles(OwnerController, OwnerController.prototype.customer, [
    "customer",
  ]);
  expectRoles(DeniedController, DeniedController.prototype.customer, [
    "customer",
  ]);
});

test("RolesGuard denies every role for empty method or controller metadata", () => {
  expectRoles(OwnerController, OwnerController.prototype.denied, []);
  expectRoles(DeniedController, DeniedController.prototype.inherited, []);
});

test("RolesGuard allows admin only when explicitly listed and ignores client role fields", () => {
  expectRoles(OwnerController, OwnerController.prototype.shared, [
    "owner",
    "admin",
  ]);
  expectRoles(NoRolesController, NoRolesController.prototype.admin, ["admin"]);
});
