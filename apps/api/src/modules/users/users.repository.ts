import { Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
} from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import { users } from "../../database/schema/index.js";
import type { AuthTransaction } from "../auth/auth.repository.js";
import type {
  AdminUserQueryInput,
  UserStatusUpdateInput,
} from "../../../../../packages/shared/src/phase4-schemas.js";
// SELECT allowlist excludes passwordHash/sessionVersion and other internal columns.
const projection = {
  id: users.id,
  fullName: users.fullName,
  email: users.email,
  phone: users.phone,
  avatarUrl: users.avatarUrl,
  role: users.role,
  status: users.status,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};
@Injectable()
export class UsersRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}
  transaction<T>(work: (tx: AuthTransaction) => Promise<T>) {
    return this.db.transaction(work);
  }
  lockUsers(tx: AuthTransaction, ids: string[]) {
    return tx
      .select()
      .from(users)
      .where(inArray(users.id, [...new Set(ids)]))
      .orderBy(asc(users.id))
      .for("update");
  }
  async detail(id: string) {
    const [row] = await this.db
      .select(projection)
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
    return row;
  }
  async status(
    tx: AuthTransaction,
    id: string,
    status: UserStatusUpdateInput["status"],
  ) {
    await tx
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id));
    const [row] = await tx
      .select(projection)
      .from(users)
      .where(eq(users.id, id));
    return row!;
  }
  async list(query: AdminUserQueryInput) {
    const literal = query.q?.replace(/[\\%_]/g, "\\$&");
    const where = and(
      isNull(users.deletedAt),
      query.role ? eq(users.role, query.role) : undefined,
      query.status ? eq(users.status, query.status) : undefined,
      literal
        ? or(
            ilike(users.fullName, `%${literal}%`),
            ilike(users.email, `%${literal}%`),
          )
        : undefined,
    );
    return this.db.transaction(
      async (tx) => {
        const totals = await tx
          .select({ total: count() })
          .from(users)
          .where(where);
        const total = totals[0]!.total,
          offset = (query.page - 1) * query.limit;
        if (!Number.isSafeInteger(offset) || offset >= total)
          return { rows: [], total };
        const rows = await tx
          .select(projection)
          .from(users)
          .where(where)
          .orderBy(desc(users.createdAt), desc(users.id))
          .limit(query.limit)
          .offset(offset);
        return { rows, total };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
