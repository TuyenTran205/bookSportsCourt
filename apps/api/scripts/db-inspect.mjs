import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
for (const name of [".env.local", ".env"]) {
  const path = new URL("../../../" + name, import.meta.url);
  if (existsSync(path)) {
    for (const [key, value] of Object.entries(parseEnv(readFileSync(path, "utf8")))) process.env[key] ??= value;
  }
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set DATABASE_URL before running database utilities.");

import { Pool } from "pg";

const connectionUrl = new URL(databaseUrl);
if (process.argv[2]) connectionUrl.pathname = "/" + process.argv[2];
const pool = new Pool({
  connectionString: connectionUrl.toString(),
});

try {
  const migrations = await pool.query(
    `select filename, applied_at from schema_migrations order by filename`,
  );
  console.log("MIGRATIONS in booksports:");
  for (const row of migrations.rows)
    console.log(" -", row.filename, row.applied_at.toISOString());

  const tables = await pool.query(
    `select tablename from pg_tables where schemaname='public' order by tablename`,
  );
  console.log(`TABLES(${tables.rows.length}):`);
  for (const row of tables.rows) console.log(" -", row.tablename);

  const counts = await pool.query(
    `select relname, n_live_tup from pg_stat_user_tables order by relname`,
  );
  console.log("ROW COUNTS (approx):");
  for (const row of counts.rows) console.log(` - ${row.relname}: ${row.n_live_tup}`);
} catch (error) {
  console.error("ERROR:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
