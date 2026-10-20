import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(
  currentDirectory,
  '..',
  'src',
  'database',
  'migrations',
);

async function loadEnvironmentFile(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    return;
  }

  const contents = await readFile(path, 'utf8');
  for (const line of contents.split(/\r?\n/u)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/u, '$2');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const repositoryRoot = join(currentDirectory, '..', '..', '..');
await loadEnvironmentFile(join(repositoryRoot, '.env.local'));
await loadEnvironmentFile(join(repositoryRoot, '.env'));

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be configured before running migrations');
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  const appliedResult = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations',
  );
  const appliedFiles = new Set(
    appliedResult.rows.map((migration) => migration.filename),
  );

  for (const filename of migrationFiles) {
    if (appliedFiles.has(filename)) {
      continue;
    }

    const sql = await readFile(join(migrationsDirectory, filename), 'utf8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [filename],
      );
      await client.query('COMMIT');
      process.stdout.write(`Applied migration ${filename}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration failed: ${filename}`, { cause: error });
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
