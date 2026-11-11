import { Injectable } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  oauthAccounts,
  oauthStates,
  users,
} from "../../database/schema/index.js";
import type { AuthTransaction } from "./auth.repository.js";

@Injectable()
export class GoogleOAuthRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}
  transaction<T>(work: (tx: AuthTransaction) => Promise<T>) {
    return this.db.transaction(work);
  }
  async saveState(input: {
    stateHash: string;
    bindingHash: string;
    nonceHash: string;
    pkceVerifierCiphertext: string;
  }) {
    await this.db
      .insert(oauthStates)
      .values({ ...input, expiresAt: sql`now() + interval '10 minutes'` });
  }
  async takeState(stateHash: string, bindingHash: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(oauthStates)
        .where(
          and(
            eq(oauthStates.stateHash, stateHash),
            eq(oauthStates.bindingHash, bindingHash),
            isNull(oauthStates.usedAt),
          ),
        )
        .for("update");
      if (!row) return null;
      const clock = await tx.execute<{ now: string }>(
        sql`select clock_timestamp() as now`,
      );
      if (row.expiresAt.getTime() <= new Date(clock.rows[0]!.now).getTime())
        return null;
      await tx
        .update(oauthStates)
        .set({
          usedAt: sql`clock_timestamp()`,
          pkceVerifierCiphertext: "consumed",
        })
        .where(eq(oauthStates.id, row.id));
      return row;
    });
  }
  async lockIdentity(tx: AuthTransaction, subject: string, email: string) {
    // Total order across both identity and email; register races still fall back to DB unique constraints.
    for (const key of [`google:${subject}`, `email:${email}`].sort()) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${key},0))`,
      );
    }
  }
  async linked(tx: AuthTransaction, subject: string) {
    const [row] = await tx
      .select()
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, "google"),
          eq(oauthAccounts.providerId, subject),
        ),
      );
    return row ?? null;
  }
  async emailExists(tx: AuthTransaction, email: string) {
    const [row] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)));
    return !!row;
  }
  async setAvatarIfMissing(tx: AuthTransaction, userId: string, avatarUrl: string) {
    await tx
      .update(users)
      .set({ avatarUrl })
      .where(and(eq(users.id, userId), isNull(users.avatarUrl)));
  }
  async create(
    tx: AuthTransaction,
    identity: { subject: string; email: string; fullName: string; picture?: string | null },
  ) {
    const [user] = await tx
      .insert(users)
      .values({
        email: identity.email,
        fullName: identity.fullName,
        avatarUrl: identity.picture ?? null,
        passwordHash: null,
        role: "customer",
        status: "active",
        emailVerifiedAt: new Date(),
      })
      .returning();
    await tx.insert(oauthAccounts).values({
      userId: user!.id,
      provider: "google",
      providerId: identity.subject,
    });
    return user!.id;
  }
  async cleanup() {
    await this.db.execute(sql`WITH stale AS (SELECT id FROM oauth_states
      WHERE expires_at < now() - interval '24 hours' ORDER BY expires_at LIMIT 500 FOR UPDATE SKIP LOCKED)
      DELETE FROM oauth_states WHERE id IN (SELECT id FROM stale)`);
  }
}
