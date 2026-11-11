import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";

const migrationsDirectory = new URL(
  "../../src/database/migrations/",
  import.meta.url,
);

export async function readVenueTestMigration(
  filename: string,
): Promise<string> {
  if (!/^\d{4}_[a-z0-9_-]+\.sql$/.test(filename))
    throw new Error("Invalid migration filename");
  return readFile(new URL(filename, migrationsDirectory), "utf8");
}

/** Uses only an explicit local test URL; never loads .env or DATABASE_URL. */
export async function withVenueTestSchema<T>(
  connectionString: string,
  run: (client: PoolClient) => Promise<T>,
  through = "9999",
): Promise<T> {
  const url = new URL(connectionString);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error("Venue fixture tests require a local PostgreSQL URL");
  }
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  const schema = `bsc014_test_${randomBytes(6).toString("hex")}`;
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    // Identifier is generated internally from hex, never supplied by a caller.
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    await client.query("SET LOCAL statement_timeout = '20s'");
    for (const filename of (await readdir(migrationsDirectory))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      if (filename.slice(0, 4) <= through)
        await client.query(await readVenueTestMigration(filename));
    }
    return await run(client);
  } finally {
    try {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } finally {
          client.release();
        }
      }
    } finally {
      await pool.end();
    }
  }
}
