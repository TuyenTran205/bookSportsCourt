import "reflect-metadata";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { EmailOutboxRepository } from "../src/modules/mail/email-outbox.repository.js";
import * as schema from "../src/database/schema/index.js";

// Explicit operator invocation only; no scheduler/provider is bootstrapped by this script.
const id = process.argv[2];
if (
  !id ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
  !process.env.DATABASE_URL
) {
  throw new Error(
    "Set DATABASE_URL and supply one failed email delivery UUID.",
  );
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
try {
  const retried = await new EmailOutboxRepository(
    drizzle(pool, { schema }),
  ).retryFailed(id);
  if (!retried) {
    console.error(
      "Not retried: requires failed email within its safe retry window; unknown needs reconciliation.",
    );
    process.exitCode = 1;
  } else
    console.log(
      "Failed delivery queued with its original request/key. No email sent by this command.",
    );
} catch {
  console.error(
    "Retry failed; no provider diagnostics or private delivery data printed.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
