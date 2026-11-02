import { Injectable } from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import { ownerApplications, users } from "../../database/schema/index.js";
import type { OwnerApplicationInput } from "../../../../../packages/shared/src/schemas.js";

@Injectable()
export class OwnerApplicationsRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  async findPendingByUserId(userId: string) {
    const [row] = await this.db
      .select()
      .from(ownerApplications)
      .where(
        and(
          eq(ownerApplications.userId, userId),
          eq(ownerApplications.status, "pending"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findLatestByUserId(userId: string) {
    const [row] = await this.db
      .select()
      .from(ownerApplications)
      .where(eq(ownerApplications.userId, userId))
      .orderBy(desc(ownerApplications.createdAt))
      .limit(1);
    return row ?? null;
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(ownerApplications)
      .where(eq(ownerApplications.id, id))
      .limit(1);
    return row ?? null;
  }

  async create(userId: string, input: OwnerApplicationInput) {
    const [row] = await this.db
      .insert(ownerApplications)
      .values({
        userId,
        businessName: input.businessName,
        phone: input.phone,
        address: input.address,
        note: input.note ?? null,
        status: "pending",
      })
      .returning();
    return row;
  }

  async list(options: { status?: string; page: number; limit: number }) {
    const offset = (options.page - 1) * options.limit;
    const condition = options.status
      ? eq(ownerApplications.status, options.status)
      : undefined;

    const [totalResult] = await this.db
      .select({ count: count() })
      .from(ownerApplications)
      .where(condition);

    const total = Number(totalResult?.count ?? 0);

    const rows = await this.db
      .select({
        id: ownerApplications.id,
        userId: ownerApplications.userId,
        businessName: ownerApplications.businessName,
        phone: ownerApplications.phone,
        address: ownerApplications.address,
        note: ownerApplications.note,
        status: ownerApplications.status,
        reviewNote: ownerApplications.reviewNote,
        reviewedBy: ownerApplications.reviewedBy,
        reviewedAt: ownerApplications.reviewedAt,
        createdAt: ownerApplications.createdAt,
        updatedAt: ownerApplications.updatedAt,
        applicant: {
          fullName: users.fullName,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(ownerApplications)
      .innerJoin(users, eq(ownerApplications.userId, users.id))
      .where(condition)
      .orderBy(desc(ownerApplications.createdAt))
      .limit(options.limit)
      .offset(offset);

    return {
      data: rows,
      meta: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit) || 1,
      },
    };
  }

  async updateStatusApproved(id: string, adminId: string, reviewNote?: string) {
    return this.db.transaction(async (tx) => {
      const [app] = await tx
        .select()
        .from(ownerApplications)
        .where(eq(ownerApplications.id, id))
        .for("update");

      if (!app) return null;

      const [updatedApp] = await tx
        .update(ownerApplications)
        .set({
          status: "approved",
          reviewNote: reviewNote ?? null,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(ownerApplications.id, id))
        .returning();

      await tx
        .update(users)
        .set({
          role: "owner",
          updatedAt: new Date(),
        })
        .where(eq(users.id, app.userId));

      return updatedApp;
    });
  }

  async updateStatusRejected(id: string, adminId: string, reviewNote?: string) {
    const [updatedApp] = await this.db
      .update(ownerApplications)
      .set({
        status: "rejected",
        reviewNote: reviewNote ?? null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ownerApplications.id, id))
      .returning();
    return updatedApp ?? null;
  }
}

