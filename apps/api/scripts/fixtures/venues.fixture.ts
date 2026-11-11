import type { PoolClient } from "pg";
import type {
  UserRole,
  UserStatus,
  VenueStatus,
} from "../../../../packages/shared/src/constants.js";

// Fixed UUID-v7-shaped IDs are test identifiers, not runtime ID generation.
const fixtureId = (n: number) =>
  `019a0000-0014-7000-8000-${n.toString().padStart(12, "0")}`;

export const venueFixtureIds = {
  users: {
    ownerA: fixtureId(1),
    ownerB: fixtureId(2),
    admin: fixtureId(3),
    customer: fixtureId(4),
    suspendedOwner: fixtureId(5),
  },
  areas: {
    provinceA: fixtureId(11),
    districtA: fixtureId(12),
    provinceB: fixtureId(13),
    districtB: fixtureId(14),
  },
  sports: { badminton: fixtureId(21), football: fixtureId(22) },
  amenities: { parking: fixtureId(31), water: fixtureId(32) },
  venues: {
    pendingA: fixtureId(41),
    approvedA: fixtureId(42),
    rejectedA: fixtureId(43),
    suspendedA: fixtureId(44),
    deletedA: fixtureId(45),
    approvedB: fixtureId(46),
    legacyRejectedB: fixtureId(47),
    suspendedOwnerVenue: fixtureId(48),
  },
  missing: fixtureId(999),
} as const;

export const venueFixtureReason = "Cần bổ sung địa chỉ cơ sở.";

export function venueCreatePayload() {
  return {
    name: "Cơ sở kiểm thử mới",
    address: "123 Đường Kiểm Thử",
    provinceId: venueFixtureIds.areas.provinceA,
    districtId: venueFixtureIds.areas.districtA,
    lat: 10.85,
    lng: 106.76,
    sportIds: [venueFixtureIds.sports.badminton],
    amenityIds: [venueFixtureIds.amenities.parking],
  };
}

/** Invalid requests, not invalid rows inserted by bypassing DB constraints. */
export function venueInvalidPayloads() {
  return {
    wrongProvince: {
      ...venueCreatePayload(),
      districtId: venueFixtureIds.areas.districtB,
    },
    wrongAreaType: {
      ...venueCreatePayload(),
      provinceId: venueFixtureIds.areas.districtA,
    },
    missingSport: {
      ...venueCreatePayload(),
      sportIds: [venueFixtureIds.missing],
    },
    missingAmenity: {
      ...venueCreatePayload(),
      amenityIds: [venueFixtureIds.missing],
    },
  };
}

export async function assertVenueTestSchema(client: PoolClient): Promise<void> {
  const result = await client.query<{ name: string }>(
    "SELECT current_schema() AS name",
  );
  if (!/^bsc014_test_[a-f0-9]{12}$/.test(result.rows[0]?.name ?? "")) {
    throw new Error(
      "Venue fixtures require an isolated bsc014_test_<12 hex> schema",
    );
  }
}

/** Insert once into an empty isolated schema; rerun by creating a new schema. */
export async function seedVenueFixtures(
  client: PoolClient,
  passwordHash: string,
  options: { legacySchema?: boolean } = {},
): Promise<typeof venueFixtureIds> {
  await assertVenueTestSchema(client);
  if (!passwordHash.startsWith("$argon2id$"))
    throw new Error("Use a test Argon2id password hash");
  const users: Array<{
    key: keyof typeof venueFixtureIds.users;
    role: UserRole;
    status: UserStatus;
  }> = [
    { key: "ownerA", role: "owner", status: "active" },
    { key: "ownerB", role: "owner", status: "active" },
    { key: "admin", role: "admin", status: "active" },
    { key: "customer", role: "customer", status: "active" },
    { key: "suspendedOwner", role: "owner", status: "suspended" },
  ];
  for (const user of users) {
    await client.query(
      `INSERT INTO users (id,email,password_hash,full_name,role,status,email_verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,'2026-10-30T00:00:00Z')`,
      [
        venueFixtureIds.users[user.key],
        `${user.key.toLowerCase()}@bsc014.example.test`,
        passwordHash,
        `BSC014 ${user.key}`,
        user.role,
        user.status,
      ],
    );
  }
  const a = venueFixtureIds.areas;
  await client.query(
    `INSERT INTO areas (id,type,name,slug,parent_id) VALUES
     ($1,'province','Tỉnh A','tinh-a',NULL), ($2,'province','Tỉnh B','tinh-b',NULL),
     ($3,'district','Quận A','quan-a',$1), ($4,'district','Quận B','quan-b',$2)`,
    [a.provinceA, a.provinceB, a.districtA, a.districtB],
  );
  await client.query(
    `INSERT INTO sports (id,name,slug) VALUES ($1,'Cầu lông','cau-long'),($2,'Bóng đá','bong-da')`,
    [venueFixtureIds.sports.badminton, venueFixtureIds.sports.football],
  );
  await client.query(
    `INSERT INTO amenities (id,name,slug) VALUES ($1,'Bãi xe','bai-xe'),($2,'Nước uống','nuoc-uong')`,
    [venueFixtureIds.amenities.parking, venueFixtureIds.amenities.water],
  );
  const venues: Array<{
    key: keyof typeof venueFixtureIds.venues;
    owner: keyof typeof venueFixtureIds.users;
    status: VenueStatus;
    deleted?: boolean;
  }> = [
    { key: "pendingA", owner: "ownerA", status: "pending" },
    { key: "approvedA", owner: "ownerA", status: "approved" },
    { key: "rejectedA", owner: "ownerA", status: "rejected" },
    { key: "suspendedA", owner: "ownerA", status: "suspended" },
    { key: "deletedA", owner: "ownerA", status: "approved", deleted: true },
    { key: "approvedB", owner: "ownerB", status: "approved" },
    { key: "legacyRejectedB", owner: "ownerB", status: "rejected" },
    { key: "suspendedOwnerVenue", owner: "suspendedOwner", status: "pending" },
  ];
  for (const [index, venue] of venues.entries()) {
    const id = venueFixtureIds.venues[venue.key];
    const legacy = venue.key === "legacyRejectedB";
    await client.query(
      `INSERT INTO venues (id,owner_id,name,slug,address,province_id,district_id,lat,lng,status,deleted_at,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
      [
        id,
        venueFixtureIds.users[venue.owner],
        `Cơ sở ${venue.key}`,
        `co-so-${id}`,
        "123 Đường Kiểm Thử",
        venue.owner === "ownerB" ? a.provinceB : a.provinceA,
        venue.owner === "ownerB" ? a.districtB : a.districtA,
        legacy ? null : 10.85,
        legacy ? null : 106.76,
        venue.status,
        venue.deleted ? "2026-10-30T01:00:00Z" : null,
        new Date(Date.UTC(2026, 9, 30, 0, index)).toISOString(),
      ],
    );
    await client.query(
      "INSERT INTO venue_sports (venue_id,sport_id) VALUES ($1,$2)",
      [id, venueFixtureIds.sports.badminton],
    );
    await client.query(
      "INSERT INTO venue_amenities (venue_id,amenity_id) VALUES ($1,$2)",
      [id, venueFixtureIds.amenities.parking],
    );
  }
  // Upgrade tests can seed before 0007; never fabricate reasons during migration.
  if (!options.legacySchema) {
    await client.query("UPDATE venues SET rejection_reason=$1 WHERE id=$2", [
      venueFixtureReason,
      venueFixtureIds.venues.rejectedA,
    ]);
  }
  return venueFixtureIds;
}
