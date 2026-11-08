import { Injectable } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";

import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  authTokens,
  refreshTokens,
  users,
} from "../../database/schema/index.js";

export type AuthUser = typeof users.$inferSelect;
export type AuthTransaction = Parameters<
  Parameters<DrizzleDb["transaction"]>[0]
>[0];

@Injectable()
export class AuthRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  transaction<T>(work: (tx: AuthTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async byEmail(email: string, tx: DrizzleDb | AuthTransaction = this.db) {
    const [user] = await tx
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)));
    return user;
  }

  async byId(id: string, tx: DrizzleDb | AuthTransaction = this.db) {
    const [user] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
    return user;
  }

  async lockUser(tx: AuthTransaction, id: string) {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, id))
      .for("update");
    return user;
  }

  async insertUser(tx: AuthTransaction, data: typeof users.$inferInsert) {
    const [user] = await tx.insert(users).values(data).returning();
    if (!user) throw new Error("User insert failed");
    return user;
  }

  async insertRefresh(
    tx: AuthTransaction,
    data: typeof refreshTokens.$inferInsert,
  ) {
    await tx.insert(refreshTokens).values(data);
  }

  async refreshByHash(hash: string, tx: DrizzleDb | AuthTransaction = this.db) {
    const [token] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash));
    return token;
  }

  async revoke(tx: AuthTransaction, id: string) {
    await tx
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.id, id));
  }

  async revokeAll(tx: AuthTransaction, userId: string) {
    await tx
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.userId, userId));
  }
  /** Caller holds the user row lock; version and refresh revocation share its transaction. */
  async invalidateSessions(tx: AuthTransaction, userId: string) {
    await tx
      .update(users)
      .set({
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    await this.revokeAll(tx, userId);
  }

  async insertToken(tx: AuthTransaction, data: typeof authTokens.$inferInsert) {
    await tx.insert(authTokens).values(data);
  }

  async tokenByHash(
    hash: string,
    tx: DrizzleDb | AuthTransaction = this.db,
    lock = false,
  ) {
    const query = tx
      .select()
      .from(authTokens)
      .where(eq(authTokens.tokenHash, hash));
    const [token] = await (lock ? query.for("update") : query);
    return token;
  }

  async now(tx: AuthTransaction) {
    const result = await tx.execute<{ now: string }>(
      sql`select clock_timestamp() as now`,
    );
    return new Date(result.rows[0]!.now);
  }

  async consumeTokens(tx: AuthTransaction, userId: string, type: string) {
    await tx
      .update(authTokens)
      .set({ usedAt: sql`clock_timestamp()` })
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.type, type),
          isNull(authTokens.usedAt),
        ),
      );
  }

  async updateUser(
    tx: AuthTransaction,
    id: string,
    data: Partial<typeof users.$inferInsert>,
  ) {
    await tx
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id));
  }
}
