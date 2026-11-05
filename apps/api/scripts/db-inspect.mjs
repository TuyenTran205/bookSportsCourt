import { Pool } from "pg";

const dbName = process.argv[2] ?? "booksportscourt";
const pool = new Pool({
  connectionString: `postgresql://postgres:MyPostGreSQl123@localhost:5432/${dbName}`,
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
