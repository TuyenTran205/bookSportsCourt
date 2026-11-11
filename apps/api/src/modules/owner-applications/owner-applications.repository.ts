import { Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import { ownerApplications, users } from "../../database/schema/index.js";
import type { OwnerApplicationInput } from "../../../../../packages/shared/src/schemas.js";
import type {
  AdminOwnerApplicationQueryInput,
  OwnerApplicationDecisionInput,
} from "../../../../../packages/shared/src/phase4-schemas.js";
import type { AuthTransaction } from "../auth/auth.repository.js";
import { writeAudit } from "../audit/audit-writer.js";

@Injectable()
export class OwnerApplicationsRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}
  transaction<T>(work: (tx: AuthTransaction) => Promise<T>) {
    return this.db.transaction(work);
  }
  async lockUsers(tx: AuthTransaction, ids: string[]) {
    return tx
      .select()
      .from(users)
      .where(inArray(users.id, [...new Set(ids)]))
      .orderBy(asc(users.id))
      .for("update");
  }
  async findPendingByUserId(
    userId: string,
    tx: AuthTransaction | DrizzleDb = this.db,
  ) {
    const [row] = await tx
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
      .orderBy(desc(ownerApplications.createdAt), desc(ownerApplications.id))
      .limit(1);
    return row ?? null;
  }
  async findById(
    id: string,
    tx: AuthTransaction | DrizzleDb = this.db,
    lock = false,
  ) {
    const query = tx
      .select()
      .from(ownerApplications)
      .where(eq(ownerApplications.id, id));
    const [row] = await (lock ? query.for("update") : query);
    return row ?? null;
  }
  async create(
    userId: string,
    input: OwnerApplicationInput,
    tx: AuthTransaction | DrizzleDb = this.db,
  ) {
    const [row] = await tx
      .insert(ownerApplications)
      .values({
        userId,
        businessName: input.businessName,
        phone: input.phone,
        address: input.address,
        lat: input.lat !== undefined && input.lat !== null ? String(input.lat) : null,
        lng: input.lng !== undefined && input.lng !== null ? String(input.lng) : null,
        note: input.note ?? null,
        taxCode: input.taxCode ?? null,
        bankBin: input.bankBin ?? null,
        bankName: input.bankName ?? null,
        accountNo: input.accountNo ?? null,
        accountName: input.accountName ?? null,
        status: "pending",
      })
      .returning();
    return row!;
  }
  async list(query: AdminOwnerApplicationQueryInput) {
    return this.db.transaction(
      async (tx) => {
        const condition =
          query.status && query.status !== "all"
            ? eq(ownerApplications.status, query.status)
            : undefined;
        const totals = await tx
          .select({ total: count() })
          .from(ownerApplications)
          .where(condition);
        const total = totals[0]!.total,
          offset = (query.page - 1) * query.limit;
        if (!Number.isSafeInteger(offset) || offset >= total)
          return { rows: [], total };
        const rows = await tx
          .select()
          .from(ownerApplications)
          .where(condition)
          .orderBy(
            desc(ownerApplications.createdAt),
            desc(ownerApplications.id),
          )
          .limit(query.limit)
          .offset(offset);
        return { rows, total };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async decide(
    tx: AuthTransaction,
    app: typeof ownerApplications.$inferSelect,
    adminId: string,
    input: OwnerApplicationDecisionInput,
  ) {
    const now = new Date();
    if (input.status === "approved")
      await tx
        .update(users)
        .set({ role: "owner", updatedAt: now })
        .where(eq(users.id, app.userId));
    const [updated] = await tx
      .update(ownerApplications)
      .set({
        status: input.status,
        reviewNote: input.reviewNote ?? null,
        reviewedBy: adminId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(ownerApplications.id, app.id))
      .returning();
    await writeAudit(tx, {
      actorId: adminId,
      action: "owner_application.reviewed",
      entityId: app.id,
      before: { status: app.status, hasReason: app.reviewNote !== null },
      after: {
        status: input.status,
        hasReason: input.reviewNote !== undefined,
      },
    });
    return updated!;
  }
}
