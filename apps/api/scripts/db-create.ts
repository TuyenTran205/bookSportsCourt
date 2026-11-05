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

import { Client } from "pg";

const client = new Client({
  connectionString:
    databaseUrl,
});

try {
  await client.connect();
  const existing = await client.query(
    `select 1 from pg_database where datname = 'booksportscourt'`,
  );
  if ((existing.rowCount ?? 0) > 0) {
    console.log("Database booksportscourt already exists");
  } else {
    await client.query(`CREATE DATABASE booksportscourt`);
    console.log("Database booksportscourt created");
  }
} catch (error) {
  console.error("ERROR:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end();
}
