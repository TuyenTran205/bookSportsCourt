import { Client } from "pg";

const client = new Client({
  connectionString:
    "postgresql://postgres:MyPostGreSQl123@localhost:5432/postgres",
});

try {
  await client.connect();
  const existing = await client.query(
    `select 1 from pg_database where datname = 'booksportscourt'`,
  );
  if (existing.rowCount > 0) {
    console.log("Database booksportscourt already exists");
  } else {
    await client.query(`CREATE DATABASE booksportscourt`);
    console.log("Database booksportscourt created");
  }
} catch (error) {
  console.error("ERROR:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
