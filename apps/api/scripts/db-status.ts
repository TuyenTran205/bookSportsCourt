import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:MyPostGreSQl123@localhost:5432/booksportscourt",
});

try {
  const tables = await pool.query(
    `select tablename from pg_tables where schemaname='public' order by tablename`,
  );
  console.log(`TABLES(${tables.rows.length}):`);
  for (const row of tables.rows) console.log(" -", row.tablename);

  const columns = await pool.query(
    `select table_name, column_name, data_type from information_schema.columns
     where table_schema='public' and table_name not in ('schema_migrations')
     order by table_name, ordinal_position`,
  );
  console.log(`COLUMNS(${columns.rows.length}):`);
  for (const row of columns.rows) console.log(` - ${row.table_name}.${row.column_name} (${row.data_type})`);

  const migrations = await pool.query(
    `select filename, applied_at from schema_migrations order by filename`,
  );
  console.log(`MIGRATIONS(${migrations.rows.length}):`);
  for (const row of migrations.rows)
    console.log(" -", row.filename, row.applied_at.toISOString());

  const constraints = await pool.query(
    `select conname, pg_get_constraintdef(oid) as def from pg_constraint
     where contype='x' order by conname`,
  );
  console.log(`EXCLUDE_CONSTRAINTS(${constraints.rows.length}):`);
  for (const row of constraints.rows) console.log(" -", row.conname, "=>", row.def);
} catch (error) {
  console.error("DB ERROR:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
