import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Pool, PoolClient } from "pg";
import { v7 } from "uuid";

import { hashPassword } from "../src/modules/auth/auth-secrets.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(currentDirectory, "..", "..", "..");

async function loadEnvironmentFile(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    return;
  }

  const contents = await readFile(path, "utf8");
  for (const line of contents.split(/\r?\n/u)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/u, "$2");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

await loadEnvironmentFile(join(repositoryRoot, ".env.local"));
await loadEnvironmentFile(join(repositoryRoot, ".env"));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be configured before running the seed");
}

const seedPassword =
  process.env.SEED_PASSWORD ?? "BookSportsCourt-Dev-Only-2026!";
const passwordHash = await hashPassword(seedPassword);
const pool = new Pool({ connectionString: databaseUrl });

function firstRow<T>(rows: T[], description: string): T {
  const row = rows[0];
  if (!row) {
    throw new Error(`Seed query returned no row: ${description}`);
  }
  return row;
}

async function ensureUser(
  client: PoolClient,
  email: string,
  fullName: string,
  role: "customer" | "owner" | "admin",
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO users (
        id, email, password_hash, full_name, role, status, email_verified_at
      )
      VALUES ($1, $2, $3, $4, $5, 'active', now())
      ON CONFLICT (email) WHERE deleted_at IS NULL
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        status = 'active',
        email_verified_at = COALESCE(users.email_verified_at, now()),
        deleted_at = NULL,
        updated_at = now()
      RETURNING id
    `,
    [v7(), email, passwordHash, fullName, role],
  );

  return firstRow(result.rows, `user ${email}`).id;
}

async function ensureArea(
  client: PoolClient,
  type: "province" | "district",
  name: string,
  slug: string,
  parentId: string | null,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `
      SELECT id
      FROM areas
      WHERE type = $1
        AND slug = $2
        AND parent_id IS NOT DISTINCT FROM $3::uuid
      LIMIT 1
    `,
    [type, slug, parentId],
  );

  if (existing.rows[0]) {
    return firstRow(existing.rows, `area ${slug}`).id;
  }

  const inserted = await client.query<{ id: string }>(
    `
      INSERT INTO areas (id, type, name, slug, parent_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [v7(), type, name, slug, parentId],
  );

  return firstRow(inserted.rows, `area ${slug} insert`).id;
}

async function ensureSport(
  client: PoolClient,
  name: string,
  slug: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO sports (id, name, slug)
      VALUES ($1, $2, $3)
      ON CONFLICT (slug)
      DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      RETURNING id
    `,
    [v7(), name, slug],
  );

  return firstRow(result.rows, `sport ${slug}`).id;
}

async function ensureAmenity(
  client: PoolClient,
  name: string,
  slug: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO amenities (id, name, slug)
      VALUES ($1, $2, $3)
      ON CONFLICT (slug)
      DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      RETURNING id
    `,
    [v7(), name, slug],
  );

  return firstRow(result.rows, `amenity ${slug}`).id;
}

try {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ownerId = await ensureUser(
      client,
      "owner.demo@booksportscourt.local",
      "Chủ sân Demo",
      "owner",
    );
    await ensureUser(
      client,
      "customer.demo@booksportscourt.local",
      "Khách hàng Demo",
      "customer",
    );
    await ensureUser(
      client,
      "admin.demo@booksportscourt.local",
      "Quản trị viên Demo",
      "admin",
    );

    const provinceId = await ensureArea(
      client,
      "province",
      "Thành phố Hồ Chí Minh",
      "ho-chi-minh",
      null,
    );
    const districtId = await ensureArea(
      client,
      "district",
      "Thành phố Thủ Đức",
      "thu-duc",
      provinceId,
    );
    const sportId = await ensureSport(client, "Cầu lông", "cau-long");
    const amenityId = await ensureAmenity(client, "Bãi đỗ xe", "bai-do-xe");

    const venueResult = await client.query<{ id: string }>(
      `
        INSERT INTO venues (
          id, owner_id, name, slug, description, address,
          province_id, district_id, lat, lng, status
        )
        VALUES (
          $1, $2, 'Sân cầu lông Demo', 'san-cau-long-demo',
          'Dữ liệu mẫu phục vụ phát triển local.',
          'Thành phố Thủ Đức, Thành phố Hồ Chí Minh',
          $3, $4, 10.8505, 106.7717, 'approved'
        )
        ON CONFLICT (slug)
        DO UPDATE SET
          owner_id = EXCLUDED.owner_id,
          province_id = EXCLUDED.province_id,
          district_id = EXCLUDED.district_id,
          status = 'approved',
          deleted_at = NULL,
          updated_at = now()
        RETURNING id
      `,
      [v7(), ownerId, provinceId, districtId],
    );
    const venueId = firstRow(venueResult.rows, "venue san-cau-long-demo").id;

    await client.query(
      `
        INSERT INTO venue_sports (venue_id, sport_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [venueId, sportId],
    );
    await client.query(
      `
        INSERT INTO venue_amenities (venue_id, amenity_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [venueId, amenityId],
    );

    const existingCourt = await client.query<{ id: string }>(
      `
        SELECT id
        FROM courts
        WHERE venue_id = $1 AND name = 'Sân A' AND deleted_at IS NULL
        ORDER BY created_at
        LIMIT 1
      `,
      [venueId],
    );
    let courtId = existingCourt.rows[0]?.id;
    if (!courtId) {
      const courtResult = await client.query<{ id: string }>(
        `
        INSERT INTO courts (id, venue_id, name, description, sport_id, status)
        VALUES ($1, $2, 'Sân A', 'Sân mẫu cho môi trường local.', $3, 'active')
        RETURNING id
      `,
        [v7(), venueId, sportId],
      );
      courtId = firstRow(courtResult.rows, "court San A insert").id;
    }

    await client.query(
      `
        INSERT INTO opening_hours (
          id, court_id, day_of_week, open_time, close_time
        )
        VALUES ($1, $2, 1, '06:00', '22:00')
        ON CONFLICT (court_id, day_of_week)
        DO UPDATE SET open_time = EXCLUDED.open_time,
                      close_time = EXCLUDED.close_time
      `,
      [v7(), courtId],
    );
    const existingPricingRule = await client.query<{ id: string }>(
      `
        SELECT id
        FROM pricing_rules
        WHERE court_id = $1
          AND name = 'Giá ngày thường'
          AND date_override IS NULL
        LIMIT 1
      `,
      [courtId],
    );
    if (!existingPricingRule.rows[0]) {
      await client.query(
        `
          INSERT INTO pricing_rules (
            id, court_id, name, price_per_slot, start_time, end_time,
            day_of_week, priority
          )
          VALUES ($1, $2, 'Giá ngày thường', 120000, '06:00', '22:00', $3, 0)
        `,
        [v7(), courtId, [1, 2, 3, 4, 5]],
      );
    }
    await client.query(
      `
        INSERT INTO venue_payment_accounts (
          venue_id, bank_bin, account_no, account_name
        )
        VALUES ($1, '970422', '0000000000', 'BOOKSPORTSCOURT DEMO')
        ON CONFLICT (venue_id)
        DO UPDATE SET bank_bin = EXCLUDED.bank_bin,
                      account_no = EXCLUDED.account_no,
                      account_name = EXCLUDED.account_name,
                      updated_at = now()
      `,
      [venueId],
    );
    await client.query(
      `
        INSERT INTO cancellation_policies (
          venue_id, cancel_before_hours, refund_percent, deposit_percent
        )
        VALUES ($1, 24, 100, 100)
        ON CONFLICT (venue_id)
        DO UPDATE SET cancel_before_hours = EXCLUDED.cancel_before_hours,
                      refund_percent = EXCLUDED.refund_percent,
                      deposit_percent = EXCLUDED.deposit_percent,
                      updated_at = now()
      `,
      [venueId],
    );

    await client.query("COMMIT");
    process.stdout.write(
      "Seed completed: 3 users, 1 venue, 1 court, catalog and pricing data.\n",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
