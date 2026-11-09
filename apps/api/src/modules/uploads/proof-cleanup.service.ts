import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { and, eq, lte, or, like } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import { payments, storageCleanupJobs } from "../../database/schema/index.js";
import { ProofStorage } from "./proof-storage.js";
import { v7 } from "uuid";

@Injectable()
export class ProofCleanupService {
  private running = false;
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDb,
    private readonly storage: ProofStorage,
  ) {}
  async register(key: string) {
    await this.db
      .insert(storageCleanupJobs)
      .values({ objectKey: key, notBefore: new Date(Date.now() + 86400000) })
      .onConflictDoNothing();
  }
  /** Claim before network; writer must check pending under this same row lock. */
  async clean(key?: string) {
    const job = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .select()
        .from(storageCleanupJobs)
        .where(
          and(
            like(storageCleanupJobs.objectKey, "proofs/%"),
            key
              ? eq(storageCleanupJobs.objectKey, key)
              : lte(storageCleanupJobs.notBefore, now),
            or(
              eq(storageCleanupJobs.status, "pending"),
              and(
                eq(storageCleanupJobs.status, "processing"),
                lte(storageCleanupJobs.leaseExpiresAt, now),
              ),
            ),
          ),
        )
        .orderBy(storageCleanupJobs.notBefore, storageCleanupJobs.id)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return null;
      if (row.attempts >= 5) {
        await tx
          .update(storageCleanupJobs)
          .set({
            status: "failed",
            leaseToken: null,
            leaseExpiresAt: null,
            updatedAt: now,
          })
          .where(eq(storageCleanupJobs.id, row.id));
        return null;
      }
      const [reference] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.proofObjectKey, row.objectKey))
        .limit(1);
      if (reference) {
        await tx
          .update(storageCleanupJobs)
          .set({
            status: "pending",
            leaseToken: null,
            leaseExpiresAt: null,
            notBefore: new Date(now.getTime() + 86400000),
            updatedAt: now,
          })
          .where(eq(storageCleanupJobs.id, row.id));
        return null;
      }
      const lease = v7();
      await tx
        .update(storageCleanupJobs)
        .set({
          status: "processing",
          attempts: Math.min(row.attempts + 1, 5),
          leaseToken: lease,
          leaseExpiresAt: new Date(now.getTime() + 120000),
          updatedAt: now,
        })
        .where(eq(storageCleanupJobs.id, row.id));
      return { ...row, lease };
    });
    if (!job) return;
    let success = false;
    try {
      await this.storage.delete(job.objectKey);
      success = true;
    } catch {
      /* Persist retry without provider diagnostics or keys in logs. */
    }
    await this.db
      .update(storageCleanupJobs)
      .set({
        status: success
          ? "completed"
          : job.attempts + 1 >= 5
            ? "failed"
            : "pending",
        leaseToken: null,
        leaseExpiresAt: null,
        lastErrorCode: success ? null : "STORAGE_DELETE_FAILED",
        notBefore: new Date(
          Math.max(
            job.notBefore.getTime(),
            Date.now() + Math.min(60, 2 ** job.attempts) * 60000,
          ),
        ),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(storageCleanupJobs.id, job.id),
          eq(storageCleanupJobs.leaseToken, job.lease),
        ),
      );
  }
  @Interval(60000)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (let n = 0; n < 5; n++) await this.clean();
    } catch {
      /* DB outage: persisted jobs remain for next tick. */
    } finally {
      this.running = false;
    }
  }
}
