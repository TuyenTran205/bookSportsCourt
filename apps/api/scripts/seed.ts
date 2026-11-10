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
  phone: string,
  avatarUrl?: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO users (
        id, email, password_hash, full_name, phone, avatar_url, role, status, email_verified_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', now())
      ON CONFLICT (email) WHERE deleted_at IS NULL
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, users.phone),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
        role = EXCLUDED.role,
        status = 'active',
        email_verified_at = COALESCE(users.email_verified_at, now()),
        deleted_at = NULL,
        updated_at = now()
      RETURNING id
    `,
    [v7(), email, passwordHash, fullName, phone, avatarUrl ?? null, role],
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
  icon: string,
  sortOrder: number,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO sports (id, name, slug, icon, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (slug)
      DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order, updated_at = now()
      RETURNING id
    `,
    [v7(), name, slug, icon, sortOrder],
  );

  return firstRow(result.rows, `sport ${slug}`).id;
}

async function ensureAmenity(
  client: PoolClient,
  name: string,
  slug: string,
  icon: string,
  sortOrder: number,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO amenities (id, name, slug, icon, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (slug)
      DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order, updated_at = now()
      RETURNING id
    `,
    [v7(), name, slug, icon, sortOrder],
  );

  return firstRow(result.rows, `amenity ${slug}`).id;
}

try {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // -------------------------------------------------------------
    // 1. USERS & ROLES
    // -------------------------------------------------------------
    const adminId = await ensureUser(
      client,
      "admin.demo@booksportscourt.local",
      "Quản trị viên Demo",
      "admin",
      "0901234567",
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&q=80",
    );
    const ownerDucId = await ensureUser(
      client,
      "owner.duc@booksportscourt.local",
      "Trần Văn Đức (Chủ sân HN & ĐN)",
      "owner",
      "0912345678",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
    );
    const ownerThaoId = await ensureUser(
      client,
      "owner.thao@booksportscourt.local",
      "Lê Thu Thảo (Chủ sân TP.HCM)",
      "owner",
      "0987654321",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
    );
    const customerLongId = await ensureUser(
      client,
      "customer.long@booksportscourt.local",
      "Nguyễn Hoàng Long",
      "customer",
      "0934567890",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
    );
    const customerTriId = await ensureUser(
      client,
      "customer.tri@booksportscourt.local",
      "Vũ Minh Trí",
      "customer",
      "0945678901",
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=256&q=80",
    );
    const applicantAnhId = await ensureUser(
      client,
      "applicant.anh@booksportscourt.local",
      "Đặng Tuấn Anh",
      "customer",
      "0956789012",
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=256&q=80",
    );
    // Legacy support
    await ensureUser(
      client,
      "owner.demo@booksportscourt.local",
      "Chủ sân Demo",
      "owner",
      "0919999999",
    );
    await ensureUser(
      client,
      "customer.demo@booksportscourt.local",
      "Khách hàng Demo",
      "customer",
      "0939999999",
    );

    // -------------------------------------------------------------
    // 2. AREAS (34 Tỉnh / Thành phố & 3.321 Xã / Phường + Legacy Districts)
    // -------------------------------------------------------------
    const provincesPath = join(repositoryRoot, "packages", "shared", "src", "data", "provinces.json");
    const wardsPath = join(repositoryRoot, "packages", "shared", "src", "data", "wards.json");
    const rawProvinces = JSON.parse(await readFile(provincesPath, "utf8")) as Array<{
      id: string;
      code: string;
      name: string;
      slug: string;
      unaccentName: string;
      isMunicipality?: boolean;
      sortOrder?: number;
    }>;
    const rawWards = JSON.parse(await readFile(wardsPath, "utf8")) as Array<{
      id: string;
      code: string;
      name: string;
      slug: string;
      provinceCode: string;
      type: string;
      unaccentName: string;
    }>;

    const provinceCodeToId = new Map<string, string>();
    for (const prov of rawProvinces) {
      const res = await client.query<{ id: string }>(
        `
          INSERT INTO areas (id, code, type, name, slug, unaccent_name, parent_id)
          VALUES ($1, $2, 'province', $3, $4, $5, NULL)
          ON CONFLICT (parent_id, slug)
          DO UPDATE SET
            code = EXCLUDED.code,
            name = EXCLUDED.name,
            unaccent_name = EXCLUDED.unaccent_name,
            updated_at = now()
          RETURNING id
        `,
        [prov.id, prov.code, prov.name, prov.slug, prov.unaccentName],
      );
      const pid = res.rows[0]?.id ?? prov.id;
      provinceCodeToId.set(prov.code, pid);
    }

    const provinceHnId = provinceCodeToId.get("01")!;
    const provinceHcmId = provinceCodeToId.get("79")!;
    const provinceDaNangId = provinceCodeToId.get("48")!;

    // Legacy districts for backward compatibility
    const districtCauGiayId = await ensureArea(client, "district", "Quận Cầu Giấy", "cau-giay", provinceHnId);
    const districtNamTuLiemId = await ensureArea(client, "district", "Quận Nam Từ Liêm", "nam-tu-liem", provinceHnId);

    const districtThuDucId = await ensureArea(client, "district", "Thành phố Thủ Đức", "thu-duc", provinceHcmId);
    const districtQuan7Id = await ensureArea(client, "district", "Quận 7", "quan-7", provinceHcmId);

    const provinceDaNangIdOld = await ensureArea(client, "province", "Đà Nẵng", "da-nang", null);
    const districtHaiChauId = await ensureArea(client, "district", "Quận Hải Châu", "hai-chau", provinceDaNangId);

    // Seeding 3.321 Wards in chunks
    const BATCH_SIZE = 200;
    const wardMap = new Map<string, string>();
    for (let i = 0; i < rawWards.length; i += BATCH_SIZE) {
      const chunk = rawWards.slice(i, i + BATCH_SIZE);
      const validChunk = chunk.filter((w) => provinceCodeToId.has(w.provinceCode));
      if (!validChunk.length) continue;

      const values: string[] = [];
      const params: unknown[] = [];
      let pIdx = 1;

      for (const w of validChunk) {
        const parentId = provinceCodeToId.get(w.provinceCode)!;
        values.push(`($${pIdx++}, $${pIdx++}, 'ward', $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
        params.push(w.id, w.code, w.name, w.slug, w.unaccentName, parentId);
      }

      const insertedWards = await client.query<{ id: string; slug: string }>(
        `
          INSERT INTO areas (id, code, type, name, slug, unaccent_name, parent_id)
          VALUES ${values.join(", ")}
          ON CONFLICT (parent_id, slug)
          DO UPDATE SET
            code = EXCLUDED.code,
            name = EXCLUDED.name,
            unaccent_name = EXCLUDED.unaccent_name,
            updated_at = now()
          RETURNING id, slug
        `,
        params,
      );
      for (const row of insertedWards.rows) {
        wardMap.set(row.slug, row.id);
      }
    }

    // -------------------------------------------------------------
    // 3. SPORTS
    // -------------------------------------------------------------
    const sportBadmintonId = await ensureSport(client, "Cầu lông", "cau-long", "badminton", 1);
    const sportSoccerId = await ensureSport(client, "Bóng đá mini", "bong-da-mini", "soccer", 2);
    const sportPickleballId = await ensureSport(client, "Pickleball", "pickleball", "pickleball", 3);
    const sportTennisId = await ensureSport(client, "Tennis", "tennis", "tennis", 4);
    const sportBasketballId = await ensureSport(client, "Bóng rổ", "bong-ro", "basketball", 5);

    // -------------------------------------------------------------
    // 4. AMENITIES
    // -------------------------------------------------------------
    const amParkingCar = await ensureAmenity(client, "Bãi đỗ xe ô tô", "bai-do-xe-oto", "car", 1);
    const amParkingMotor = await ensureAmenity(client, "Bãi đỗ xe máy", "bai-do-xe-may", "bike", 2);
    const amCanteen = await ensureAmenity(client, "Căn tin & Nước uống", "can-tin-nuoc-uong", "coffee", 3);
    const amLocker = await ensureAmenity(client, "Phòng thay đồ & Tủ gửi đồ", "phong-thay-do", "locker", 4);
    const amShower = await ensureAmenity(client, "Phòng tắm nóng lạnh", "phong-tam-nong-lanh", "shower", 5);
    const amWifi = await ensureAmenity(client, "Wifi miễn phí", "wifi-mien-phi", "wifi", 6);
    const amLighting = await ensureAmenity(client, "Đèn chiếu sáng ban đêm", "den-chieu-sang", "lightbulb", 7);
    const amRental = await ensureAmenity(client, "Cho thuê vợt & bóng", "cho-thue-dung-cu", "sports_tennis", 8);

    // -------------------------------------------------------------
    // 5. OWNER APPLICATIONS (Đơn đăng ký chủ sân)
    // -------------------------------------------------------------
    await client.query(
      `
        INSERT INTO owner_applications (
          id, user_id, business_name, tax_code, phone, address, note,
          status, review_note, reviewed_by, reviewed_at
        )
        VALUES (
          $1, $2, 'Hộ kinh doanh Thể thao Nam Sài Gòn', '0315928374',
          '0987654321', 'Đường Nguyễn Thị Thập, Phường Tân Phú, Quận 7, TP.HCM',
          'Đăng ký đối tác cụm sân bóng đá mini và tennis.',
          'approved', 'Hồ sơ đầy đủ, giấy phép kinh doanh hợp lệ.', $3, now() - interval '30 days'
        )
        ON CONFLICT DO NOTHING
      `,
      [v7(), ownerThaoId, adminId],
    );

    const existingPendingApp = await client.query(
      `SELECT id FROM owner_applications WHERE user_id = $1 AND status = 'pending'`,
      [applicantAnhId],
    );
    if (!existingPendingApp.rows[0]) {
      await client.query(
        `
          INSERT INTO owner_applications (
            id, user_id, business_name, tax_code, phone, address, note,
            status
          )
          VALUES (
            $1, $2, 'CLB Pickleball Mỹ Đình', '0109876543',
            '0956789012', 'Khu liên hợp Thể thao Mỹ Đình, Nam Từ Liêm, Hà Nội',
            'Hồ sơ đăng ký cụm 4 sân Pickleball mới chuẩn bị khai trương.',
            'pending'
          )
        `,
        [v7(), applicantAnhId],
      );
    }

    // -------------------------------------------------------------
    // 6. VENUES (Cụm sân)
    // -------------------------------------------------------------
    async function ensureVenue(
      slug: string,
      name: string,
      ownerId: string,
      provinceId: string,
      districtId: string,
      address: string,
      lat: number,
      lng: number,
      coverUrl: string,
      fromPrice: number,
      status: "approved" | "pending",
      description: string,
      wardId?: string | null,
    ): Promise<string> {
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO venues (
            id, owner_id, name, slug, description, address,
            province_id, ward_id, district_id, lat, lng, status, cover_url, from_price
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          )
          ON CONFLICT (slug)
          DO UPDATE SET
            owner_id = EXCLUDED.owner_id,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            address = EXCLUDED.address,
            province_id = EXCLUDED.province_id,
            ward_id = EXCLUDED.ward_id,
            district_id = EXCLUDED.district_id,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            status = EXCLUDED.status,
            cover_url = EXCLUDED.cover_url,
            from_price = EXCLUDED.from_price,
            deleted_at = NULL,
            updated_at = now()
          RETURNING id
        `,
        [
          v7(),
          ownerId,
          name,
          slug,
          description,
          address,
          provinceId,
          wardId ?? null,
          districtId,
          lat,
          lng,
          status,
          coverUrl,
          fromPrice,
        ],
      );
      return firstRow(result.rows, `venue ${slug}`).id;
    }

    const venue1Id = await ensureVenue(
      "clb-cau-long-pickleball-cau-giay",
      "CLB Cầu Lông & Pickleball Cầu Giấy",
      ownerDucId,
      provinceHnId,
      districtCauGiayId,
      "Số 35 Phố Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội",
      21.0333,
      105.7833,
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80",
      120000,
      "approved",
      "Cụm sân cầu lông thảm Yonex chuẩn quốc tế và sân Pickleball ngoài trời thoáng mát, hệ thống ánh sáng chống chói mắt.",
      wardMap.get("dich-vong-hau"),
    );

    const venue2Id = await ensureVenue(
      "trung-tam-bong-da-tennis-nam-sai-gon",
      "Trung Tâm Bóng Đá & Tennis Nam Sài Gòn",
      ownerThaoId,
      provinceHcmId,
      districtQuan7Id,
      "Số 48 Đường Nguyễn Thị Thập, Tân Phú, Quận 7, TP.HCM",
      10.7324,
      106.7196,
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
      150000,
      "approved",
      "Hệ thống sân cỏ nhân tạo nhập khẩu tiêu chuẩn FIFA và 2 sân quần vợt chuyên nghiệp có khán đài.",
      wardMap.get("tan-phu"),
    );

    const venue3Id = await ensureVenue(
      "khu-phuc-hop-the-thao-song-han",
      "Khu Phức Hợp Thể Thao Sông Hàn",
      ownerDucId,
      provinceDaNangId,
      districtHaiChauId,
      "Số 12 Đường Như Nguyệt, Thuận Phước, Quận Hải Châu, Đà Nẵng",
      16.0678,
      108.2208,
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
      100000,
      "approved",
      "Khu phức hợp thể thao đa năng bên bờ sông Hàn thơ mộng, phục vụ cầu lông, bóng rổ và thể thao cộng đồng.",
      wardMap.get("thuan-phuoc"),
    );

    const venue4Id = await ensureVenue(
      "cum-san-pickleball-my-dinh",
      "Cụm Sân Pickleball Mỹ Đình",
      ownerDucId,
      provinceHnId,
      districtNamTuLiemId,
      "Đường Lê Đức Thọ, Phường Mỹ Đình 1, Quận Nam Từ Liêm, Hà Nội",
      21.0185,
      105.7656,
      "https://images.unsplash.com/photo-1599586120429-48281b6f0ece?auto=format&fit=crop&w=1200&q=80",
      140000,
      "pending",
      "Sân mới đang hoàn thiện đăng ký hồ sơ kiểm duyệt.",
      wardMap.get("my-dinh-1"),
    );

    // Gắn môn thể thao cho Venues
    async function linkVenueSport(venueId: string, sportId: string): Promise<void> {
      await client.query(
        `INSERT INTO venue_sports (venue_id, sport_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [venueId, sportId],
      );
    }
    await linkVenueSport(venue1Id, sportBadmintonId);
    await linkVenueSport(venue1Id, sportPickleballId);
    await linkVenueSport(venue2Id, sportSoccerId);
    await linkVenueSport(venue2Id, sportTennisId);
    await linkVenueSport(venue3Id, sportBadmintonId);
    await linkVenueSport(venue3Id, sportBasketballId);
    await linkVenueSport(venue4Id, sportPickleballId);

    // Gắn tiện ích cho Venues
    async function linkVenueAmenity(venueId: string, amenityId: string): Promise<void> {
      await client.query(
        `INSERT INTO venue_amenities (venue_id, amenity_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [venueId, amenityId],
      );
    }
    for (const amId of [amParkingCar, amParkingMotor, amCanteen, amLocker, amShower, amWifi, amRental]) {
      await linkVenueAmenity(venue1Id, amId);
    }
    for (const amId of [amParkingCar, amParkingMotor, amCanteen, amLocker, amLighting, amWifi]) {
      await linkVenueAmenity(venue2Id, amId);
    }
    for (const amId of [amParkingMotor, amCanteen, amWifi, amLighting]) {
      await linkVenueAmenity(venue3Id, amId);
    }

    // -------------------------------------------------------------
    // 7. VENUE IMAGES (Thư viện ảnh sân)
    // -------------------------------------------------------------
    await client.query(
      `
        INSERT INTO venue_images (id, venue_id, url, sort_order)
        VALUES 
          ($1, $2, 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80', 1),
          ($3, $2, 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80', 2),
          ($4, $5, 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80', 1),
          ($6, $5, 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80', 2),
          ($7, $8, 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80', 1)
        ON CONFLICT DO NOTHING
      `,
      [v7(), venue1Id, v7(), v7(), venue2Id, v7(), v7(), venue3Id],
    );

    // -------------------------------------------------------------
    // 8. VENUE PAYMENT ACCOUNTS & CANCELLATION POLICIES
    // -------------------------------------------------------------
    await client.query(
      `
        INSERT INTO venue_payment_accounts (venue_id, bank_bin, account_no, account_name)
        VALUES 
          ($1, '970436', '0011004567890', 'TRAN VAN DUC'),
          ($2, '970422', '0987654321', 'LE THU THAO'),
          ($3, '970407', '19034567890123', 'TRAN VAN DUC')
        ON CONFLICT (venue_id)
        DO UPDATE SET
          bank_bin = EXCLUDED.bank_bin,
          account_no = EXCLUDED.account_no,
          account_name = EXCLUDED.account_name,
          updated_at = now()
      `,
      [venue1Id, venue2Id, venue3Id],
    );

    await client.query(
      `
        INSERT INTO cancellation_policies (venue_id, cancel_before_hours, refund_percent, deposit_percent)
        VALUES 
          ($1, 24, 100, 50),
          ($2, 24, 100, 30),
          ($3, 24, 100, 50)
        ON CONFLICT (venue_id)
        DO UPDATE SET
          cancel_before_hours = EXCLUDED.cancel_before_hours,
          refund_percent = EXCLUDED.refund_percent,
          deposit_percent = EXCLUDED.deposit_percent,
          updated_at = now()
      `,
      [venue1Id, venue2Id, venue3Id],
    );

    // -------------------------------------------------------------
    // 9. COURTS (Sân con)
    // -------------------------------------------------------------
    async function ensureCourt(
      venueId: string,
      name: string,
      sportId: string,
      description: string,
      sortOrder: number,
    ): Promise<string> {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM courts WHERE venue_id = $1 AND name = $2 AND deleted_at IS NULL LIMIT 1`,
        [venueId, name],
      );
      if (existing.rows[0]) {
        return existing.rows[0].id;
      }
      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO courts (id, venue_id, name, description, sport_id, status, sort_order)
          VALUES ($1, $2, $3, $4, $5, 'active', $6)
          RETURNING id
        `,
        [v7(), venueId, name, description, sportId, sortOrder],
      );
      return firstRow(inserted.rows, `court ${name}`).id;
    }

    const courtBadmintonA1 = await ensureCourt(
      venue1Id,
      "Sân Cầu Lông A1 (VIP Thảm Yonex)",
      sportBadmintonId,
      "Mặt thảm xanh Yonex chuyên nghiệp, khán đài mini.",
      1,
    );
    const courtBadmintonA2 = await ensureCourt(
      venue1Id,
      "Sân Cầu Lông A2 (Tiêu Chuẩn)",
      sportBadmintonId,
      "Sân cầu lông tiêu chuẩn luyện tập.",
      2,
    );
    const courtPickleballP1 = await ensureCourt(
      venue1Id,
      "Sân Pickleball P1",
      sportPickleballId,
      "Sân Pickleball tiêu chuẩn mặt sân bám chống trơn trượt.",
      3,
    );

    const courtSoccer1 = await ensureCourt(
      venue2Id,
      "Sân Bóng Mini 7 Người - Sân 1",
      sportSoccerId,
      "Mặt cỏ nhân tạo cao cấp tiêu chuẩn FIFA.",
      1,
    );
    const courtTennisT1 = await ensureCourt(
      venue2Id,
      "Sân Tennis T1",
      sportTennisId,
      "Mặt sân cứng US Open tiêu chuẩn quốc tế.",
      2,
    );

    const courtSongHanS1 = await ensureCourt(
      venue3Id,
      "Sân Cầu Lông S1",
      sportBadmintonId,
      "Sân cầu lông sàn gỗ đệm cao su cao cấp.",
      1,
    );

    const allCourts = [
      courtBadmintonA1,
      courtBadmintonA2,
      courtPickleballP1,
      courtSoccer1,
      courtTennisT1,
      courtSongHanS1,
    ];

    // -------------------------------------------------------------
    // 10. OPENING HOURS & PRICING RULES (06:00 - 22:30, 0=Sun, 1=Mon... 6=Sat)
    // -------------------------------------------------------------
    for (const cId of allCourts) {
      for (let day = 0; day <= 6; day++) {
        await client.query(
          `
            INSERT INTO opening_hours (id, court_id, day_of_week, open_time, close_time)
            VALUES ($1, $2, $3, '06:00', '22:30')
            ON CONFLICT (court_id, day_of_week)
            DO UPDATE SET open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time
          `,
          [v7(), cId, day],
        );
      }
    }

    // Pricing rules cho từng sân
    async function ensurePricingRule(
      courtId: string,
      name: string,
      pricePerSlot: number,
      startTime: string,
      endTime: string,
      days: number[],
      priority: number,
    ): Promise<void> {
      const existing = await client.query(
        `SELECT id FROM pricing_rules WHERE court_id = $1 AND name = $2 LIMIT 1`,
        [courtId, name],
      );
      if (!existing.rows[0]) {
        await client.query(
          `
            INSERT INTO pricing_rules (
              id, court_id, name, price_per_slot, start_time, end_time, day_of_week, priority
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [v7(), courtId, name, pricePerSlot, startTime, endTime, days, priority],
        );
      }
    }

    for (const cId of [courtBadmintonA1, courtBadmintonA2]) {
      await ensurePricingRule(cId, "Giá ngày thường (Sáng/Chiều)", 120000, "06:00", "17:00", [1, 2, 3, 4, 5], 0);
      await ensurePricingRule(cId, "Giá giờ vàng (Tối cao điểm)", 180000, "17:00", "22:30", [1, 2, 3, 4, 5], 1);
      await ensurePricingRule(cId, "Giá cuối tuần", 200000, "06:00", "22:30", [0, 6], 2);
    }
    await ensurePricingRule(courtPickleballP1, "Giá ngày thường Pickleball", 140000, "06:00", "17:00", [1, 2, 3, 4, 5], 0);
    await ensurePricingRule(courtPickleballP1, "Giá giờ vàng Pickleball", 200000, "17:00", "22:30", [1, 2, 3, 4, 5], 1);
    await ensurePricingRule(courtPickleballP1, "Giá cuối tuần Pickleball", 220000, "06:00", "22:30", [0, 6], 2);

    await ensurePricingRule(courtSoccer1, "Giá ngày thường Sân bóng", 150000, "06:00", "17:00", [1, 2, 3, 4, 5], 0);
    await ensurePricingRule(courtSoccer1, "Giá giờ vàng Sân bóng", 250000, "17:00", "22:30", [1, 2, 3, 4, 5], 1);
    await ensurePricingRule(courtSoccer1, "Giá cuối tuần Sân bóng", 280000, "06:00", "22:30", [0, 6], 2);

    await ensurePricingRule(courtTennisT1, "Giá ngày thường Tennis", 160000, "06:00", "17:00", [1, 2, 3, 4, 5], 0);
    await ensurePricingRule(courtTennisT1, "Giá giờ vàng Tennis", 240000, "17:00", "22:30", [1, 2, 3, 4, 5], 1);
    await ensurePricingRule(courtTennisT1, "Giá cuối tuần Tennis", 260000, "06:00", "22:30", [0, 6], 2);

    await ensurePricingRule(courtSongHanS1, "Giá ngày thường", 100000, "06:00", "17:00", [1, 2, 3, 4, 5], 0);
    await ensurePricingRule(courtSongHanS1, "Giá giờ vàng", 150000, "17:00", "22:30", [1, 2, 3, 4, 5], 1);
    await ensurePricingRule(courtSongHanS1, "Giá cuối tuần", 170000, "06:00", "22:30", [0, 6], 2);

    // -------------------------------------------------------------
    // 11. BLACKOUT PERIODS (Lịch bảo trì sân)
    // -------------------------------------------------------------
    const existingBlackout = await client.query(
      `SELECT id FROM blackout_periods WHERE court_id = $1 LIMIT 1`,
      [courtBadmintonA2],
    );
    if (!existingBlackout.rows[0]) {
      await client.query(
        `
          INSERT INTO blackout_periods (id, court_id, reason, during)
          VALUES (
            $1, $2, 'Bảo trì thay thảm và căn chỉnh hệ thống đèn LED',
            tstzrange(
              date_trunc('day', now() + interval '3 days') + interval '13 hours',
              date_trunc('day', now() + interval '3 days') + interval '16 hours',
              '[)'
            )
          )
        `,
        [v7(), courtBadmintonA2],
      );
    }

    // -------------------------------------------------------------
    // 12. BOOKINGS & PAYMENTS (Kịch bản đặt sân và dòng tiền đồng bộ)
    // -------------------------------------------------------------
    // Booking 1: Hoàn tất tuần trước (completed)
    const booking1Id = v7();
    await client.query(
      `
        INSERT INTO bookings (
          id, court_id, customer_id, source, during, status, total_price, deposit_amount,
          expires_at, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, 'online',
          tstzrange(
            date_trunc('day', now() - interval '6 days') + interval '18 hours',
            date_trunc('day', now() - interval '6 days') + interval '19 hours 30 minutes',
            '[)'
          ),
          'completed', 540000, 270000,
          NULL, now() - interval '7 days', now() - interval '6 days'
        )
        ON CONFLICT DO NOTHING
      `,
      [booking1Id, courtBadmintonA1, customerLongId],
    );

    // Payment 1 for Booking 1 (completed)
    await client.query(
      `
        INSERT INTO payments (
          id, booking_id, amount, provider, transfer_code, status, paid_at,
          bank_account_snapshot, reviewed_by, reviewed_at
        )
        VALUES (
          $1, $2, 270000, 'bank_transfer', 'BSC2411001', 'completed', now() - interval '7 days',
          $3, $4, now() - interval '7 days'
        )
        ON CONFLICT DO NOTHING
      `,
      [
        v7(),
        booking1Id,
        JSON.stringify({
          bankBin: "970436",
          accountNo: "0011004567890",
          accountName: "TRAN VAN DUC",
        }),
        ownerDucId,
      ],
    );

    // Review for Booking 1 (kích hoạt trigger refresh_venue_rating)
    await client.query(
      `
        INSERT INTO reviews (
          id, booking_id, venue_id, customer_id, rating, content, is_visible,
          owner_reply, owner_replied_at
        )
        VALUES (
          $1, $2, $3, $4, 5,
          'Mặt thảm Yonex cực êm, ánh sáng dịu không chói mắt, điều hòa quạt mát. Sẽ quay lại thường xuyên!',
          true,
          'Cảm ơn anh Long đã nhiệt tình ủng hộ CLB Cầu Giấy, hẹn gặp lại anh tuần tới!',
          now() - interval '5 days'
        )
        ON CONFLICT DO NOTHING
      `,
      [v7(), booking1Id, venue1Id, customerLongId],
    );

    // Booking 2: Đã xác nhận cọc - tối mai (confirmed)
    const booking2Id = v7();
    await client.query(
      `
        INSERT INTO bookings (
          id, court_id, customer_id, source, during, status, total_price, deposit_amount,
          expires_at, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, 'online',
          tstzrange(
            date_trunc('day', now() + interval '1 day') + interval '19 hours',
            date_trunc('day', now() + interval '1 day') + interval '20 hours 30 minutes',
            '[)'
          ),
          'confirmed', 480000, 240000,
          NULL, now() - interval '4 hours', now() - interval '2 hours'
        )
        ON CONFLICT DO NOTHING
      `,
      [booking2Id, courtPickleballP1, customerLongId],
    );

    // Payment 2 for Booking 2 (completed)
    await client.query(
      `
        INSERT INTO payments (
          id, booking_id, amount, provider, transfer_code, status, paid_at,
          bank_account_snapshot, reviewed_by, reviewed_at
        )
        VALUES (
          $1, $2, 240000, 'bank_transfer', 'BSC2411002', 'completed', now() - interval '3 hours',
          $3, $4, now() - interval '2 hours'
        )
        ON CONFLICT DO NOTHING
      `,
      [
        v7(),
        booking2Id,
        JSON.stringify({
          bankBin: "970436",
          accountNo: "0011004567890",
          accountName: "TRAN VAN DUC",
        }),
        ownerDucId,
      ],
    );

    // Booking 3: Đang giữ chỗ lúc này (held, có expires_at)
    const booking3Id = v7();
    await client.query(
      `
        INSERT INTO bookings (
          id, court_id, customer_id, source, during, status, total_price, deposit_amount,
          expires_at, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, 'online',
          tstzrange(
            date_trunc('day', now() + interval '2 days') + interval '20 hours',
            date_trunc('day', now() + interval '2 days') + interval '21 hours 30 minutes',
            '[)'
          ),
          'held', 540000, 270000,
          now() + interval '12 minutes', now(), now()
        )
        ON CONFLICT DO NOTHING
      `,
      [booking3Id, courtBadmintonA1, customerTriId],
    );

    // Payment 3 for Booking 3 (pending)
    await client.query(
      `
        INSERT INTO payments (
          id, booking_id, amount, provider, transfer_code, status,
          bank_account_snapshot
        )
        VALUES (
          $1, $2, 270000, 'bank_transfer', 'BSC2411003', 'pending',
          $3
        )
        ON CONFLICT DO NOTHING
      `,
      [
        v7(),
        booking3Id,
        JSON.stringify({
          bankBin: "970436",
          accountNo: "0011004567890",
          accountName: "TRAN VAN DUC",
        }),
      ],
    );

    // Booking 4: Hủy trước 24h & đã hoàn tiền cọc (cancelled, refunded)
    const booking4Id = v7();
    await client.query(
      `
        INSERT INTO bookings (
          id, court_id, customer_id, source, during, status, total_price, deposit_amount,
          cancelled_by, cancel_reason, cancelled_at, expires_at, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, 'online',
          tstzrange(
            date_trunc('day', now() + interval '4 days') + interval '18 hours',
            date_trunc('day', now() + interval '4 days') + interval '19 hours 30 minutes',
            '[)'
          ),
          'cancelled', 750000, 225000,
          $3, 'Đội bóng bận lịch thi đấu trường đột xuất', now() - interval '1 day', NULL,
          now() - interval '3 days', now() - interval '1 day'
        )
        ON CONFLICT DO NOTHING
      `,
      [booking4Id, courtSoccer1, customerTriId],
    );

    // Payment 4 for Booking 4 (refunded)
    await client.query(
      `
        INSERT INTO payments (
          id, booking_id, amount, provider, transfer_code, status, paid_at,
          refund_amount, refunded_at, refund_note, bank_account_snapshot
        )
        VALUES (
          $1, $2, 225000, 'bank_transfer', 'BSC2411004', 'refunded', now() - interval '2 days',
          225000, now() - interval '1 day', 'Đã hoàn 100% tiền cọc theo chính sách hủy trước 24h',
          $3
        )
        ON CONFLICT DO NOTHING
      `,
      [
        v7(),
        booking4Id,
        JSON.stringify({
          bankBin: "970422",
          accountNo: "0987654321",
          accountName: "LE THU THAO",
        }),
      ],
    );

    // -------------------------------------------------------------
    // 13. FAVORITES (Sân yêu thích)
    // -------------------------------------------------------------
    await client.query(
      `
        INSERT INTO favorites (user_id, venue_id)
        VALUES 
          ($1, $2),
          ($1, $3),
          ($4, $5)
        ON CONFLICT DO NOTHING
      `,
      [customerLongId, venue1Id, venue3Id, customerTriId, venue2Id],
    );

    // -------------------------------------------------------------
    // 14. NOTIFICATIONS (Thông báo hệ thống)
    // -------------------------------------------------------------
    await client.query(
      `
        INSERT INTO notifications (id, user_id, type, event_key, title, body, data, read_at)
        VALUES 
          (
            $1, $2, 'booking_confirmed', 'notif_bk_confirmed_2',
            'Đặt sân thành công!',
            'Lịch đặt sân Pickleball P1 lúc 19:00 ngày mai đã được xác nhận thanh toán cọc.',
            $3, now() - interval '1 hour'
          ),
          (
            $4, $2, 'review_reminder', 'notif_bk_review_1',
            'Đánh giá trải nghiệm sân',
            'Hãy để lại đánh giá cho lượt chơi tại CLB Cầu Giấy tuần trước để nhận ưu đãi.',
            $5, now() - interval '4 days'
          ),
          (
            $6, $7, 'refund_completed', 'notif_bk_refund_4',
            'Hoàn tiền cọc thành công',
            'Yêu cầu hủy sân bóng đá của bạn đã được duyệt. Tiền cọc 225.000đ đã được hoàn trả.',
            $8, NULL
          ),
          (
            $9, $10, 'new_booking', 'notif_owner_new_bk_2',
            'Có lượt đặt sân mới cần xác nhận',
            'Khách hàng Nguyễn Hoàng Long vừa đặt lịch tại Sân Pickleball P1 tối mai.',
            $11, now() - interval '2 hours'
          )
        ON CONFLICT DO NOTHING
      `,
      [
        v7(),
        customerLongId,
        JSON.stringify({ bookingId: booking2Id }),
        v7(),
        JSON.stringify({ bookingId: booking1Id }),
        v7(),
        customerTriId,
        JSON.stringify({ bookingId: booking4Id }),
        v7(),
        ownerDucId,
        JSON.stringify({ bookingId: booking2Id }),
      ],
    );

    // -------------------------------------------------------------
    // 15. OUTBOX DELIVERIES (Hàng đợi gửi Email / Realtime)
    // -------------------------------------------------------------
    await client.query(
      `
        INSERT INTO outbox_deliveries (
          id, event_key, event_type, channel, recipient_id, payload,
          status, attempts, delivered_at
        )
        VALUES 
          (
            $1, 'email_booking_confirmed_2', 'booking.confirmed', 'email', $2,
            $3, 'delivered', 1, now() - interval '2 hours'
          ),
          (
            $4, 'email_payment_reminder_3', 'payment.reminder', 'email', $5,
            $6, 'pending', 0, NULL
          )
        ON CONFLICT (event_key, channel, recipient_id) DO NOTHING
      `,
      [
        v7(),
        customerLongId,
        JSON.stringify({ bookingId: booking2Id, depositAmount: 240000 }),
        v7(),
        customerTriId,
        JSON.stringify({ bookingId: booking3Id, expiresInMinutes: 12 }),
      ],
    );

    // -------------------------------------------------------------
    // 16. STORAGE CLEANUP JOBS (Tác vụ dọn dẹp file tạm)
    // -------------------------------------------------------------
    await client.query(
      `
        INSERT INTO storage_cleanup_jobs (
          id, object_key, not_before, status, attempts
        )
        VALUES 
          ($1, 'uploads/temp/receipt_20261101_expired.jpg', now() - interval '1 day', 'completed', 1),
          ($2, 'uploads/temp/receipt_20261109_draft.png', now() + interval '12 hours', 'pending', 0)
        ON CONFLICT (object_key) DO NOTHING
      `,
      [v7(), v7()],
    );

    // -------------------------------------------------------------
    // 17. AUDIT LOGS (Nhật ký kiểm toán)
    // -------------------------------------------------------------
    await client.query(
      `
        INSERT INTO audit_logs (
          id, actor_id, action, entity_type, entity_id, new_data, ip_address, created_at
        )
        VALUES 
          (
            $1, $2, 'approve_venue', 'venues', $3,
            $4, '127.0.0.1'::inet, now() - interval '10 days'
          ),
          (
            $5, $2, 'approve_owner_application', 'owner_applications', $6,
            $7, '127.0.0.1'::inet, now() - interval '30 days'
          ),
          (
            $8, $9, 'confirm_payment', 'payments', $10,
            $11, '127.0.0.1'::inet, now() - interval '2 hours'
          )
        ON CONFLICT DO NOTHING
      `,
      [
        v7(),
        adminId,
        venue1Id,
        JSON.stringify({ status: "approved" }),
        v7(),
        adminId,
        JSON.stringify({ status: "approved" }),
        v7(),
        ownerDucId,
        booking2Id,
        JSON.stringify({ status: "completed" }),
      ],
    );

    // -------------------------------------------------------------
    // 18. AUTH TOKENS, REFRESH TOKENS, OAUTH ACCOUNTS & OAUTH STATES
    // -------------------------------------------------------------
    // Auth token (reset password token còn hạn cho applicant)
    await client.query(
      `
        INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at)
        VALUES ($1, $2, 'password_reset', 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90', now() + interval '2 hours')
        ON CONFLICT (token_hash) DO NOTHING
      `,
      [v7(), applicantAnhId],
    );

    // Refresh token hoạt động cho customerLong
    await client.query(
      `
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked)
        VALUES ($1, $2, 'c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2', now() + interval '7 days', false)
        ON CONFLICT (token_hash) DO NOTHING
      `,
      [v7(), customerLongId],
    );

    // OAuth account (Google login cho customerLong)
    await client.query(
      `
        INSERT INTO oauth_accounts (id, user_id, provider, provider_id)
        VALUES ($1, $2, 'google', '109283746592837465')
        ON CONFLICT (provider, provider_id) DO NOTHING
      `,
      [v7(), customerLongId],
    );

    // OAuth state (Thỏa mãn regex SHA-256 64 ký tự và thời hạn <= 10 phút)
    await client.query(
      `
        INSERT INTO oauth_states (
          id, state_hash, binding_hash, nonce_hash, pkce_verifier_ciphertext, created_at, expires_at
        )
        VALUES (
          $1,
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
          'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
          'sample_encrypted_pkce_verifier_demo_2026',
          now(),
          now() + interval '8 minutes'
        )
        ON CONFLICT (state_hash) DO NOTHING
      `,
      [v7()],
    );

    await client.query("COMMIT");
    process.stdout.write(
      "✅ Seed completed successfully: All 28 tables populated with rich, synchronized data!\n",
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
