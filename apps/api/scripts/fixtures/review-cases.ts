import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { Pool } from "pg";
import { v7 } from "uuid";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { phase4FixtureIds as ids } from "./phase4.fixture.js";
import {
  reviewAdminSchema,
  reviewPublicSchema,
  phase4DataEnvelope,
  phase4ListEnvelope,
  phase4ErrorEnvelopeSchema,
} from "../../../../packages/shared/src/phase4-responses.js";
import { ReviewsRepository } from "../../src/modules/reviews/reviews.repository.js";
import {
  reviewAdminOpenApi,
  reviewPublicOpenApi,
} from "../../src/modules/reviews/reviews.swagger.js";

type Request = (
  path: string,
  who?: string,
  method?: string,
  body?: unknown,
) => Promise<Response>;
export async function runReviewCases(
  t: TestContext,
  app: INestApplication,
  pool: Pool,
  request: Request,
) {
  const repo = app.get(ReviewsRepository);
  const post = (
    bookingId: string,
    who = "customerA",
    extra: Record<string, unknown> = {},
  ) => request("/reviews", who, "POST", { bookingId, rating: 5, ...extra });
  const review = async (
    bookingId = ids.bookings.legacy,
    who = "customerA",
    extra: Record<string, unknown> = {},
  ) => {
    const response = await post(bookingId, who, extra);
    assert.equal(response.status, 201);
    return phase4DataEnvelope(reviewAdminSchema).parse(await response.json())
      .data;
  };
  const visible = (id: string, value: boolean, who = "adminA") =>
    request(`/reviews/${id}/visibility`, who, "PATCH", { isVisible: value });
  const booking = async (customerId: string | null, status = "completed") => {
    const id = v7();
    await pool.query(
      `INSERT INTO bookings(id,court_id,customer_id,source,guest_name,during,status,total_price,deposit_amount)
      VALUES($1,$2,$3,$4,$5,tstzrange('2035-06-01T01:00:00Z','2035-06-01T02:00:00Z','[)'),$6,100000,50000)`,
      [
        id,
        ids.courts.a,
        customerId,
        customerId ? "online" : "manual",
        customerId ? null : "Guest",
        status,
      ],
    );
    return id;
  };
  const cache = async () => {
    const rows = (
      await pool.query(
        `SELECT v.id,v.rating_avg::float8 AS actual_avg,v.review_count AS actual_count,
      coalesce(round(avg(r.rating) FILTER(WHERE r.is_visible),2),0)::float8 AS expected_avg,
      count(r.id) FILTER(WHERE r.is_visible)::int AS expected_count FROM venues v LEFT JOIN reviews r ON r.venue_id=v.id
      WHERE v.id=ANY($1::uuid[]) GROUP BY v.id`,
        [[ids.venues.a, ids.venues.b]],
      )
    ).rows;
    for (const row of rows) {
      assert.equal(row.actual_avg, row.expected_avg);
      assert.equal(row.actual_count, row.expected_count);
    }
    return rows.find((row) => row.id === ids.venues.a)!;
  };
  t.beforeEach(async () => {
    await pool.query(
      "DELETE FROM reviews; DELETE FROM audit_logs WHERE entity_type='review'",
    );
  });
  await t.test(
    "role/status enforcement and Owner cannot moderate",
    async () => {
      for (const [who, status] of [
        ["guest", 401],
        ["ownerA", 403],
        ["adminA", 403],
        ["suspendedOwner", 403],
      ] as const) {
        assert.equal((await post(ids.bookings.legacy, who)).status, status);
        assert.equal(
          (await request("/admin/reviews", who)).status,
          who === "adminA" ? 200 : status,
        );
        assert.equal(
          (await visible(v7(), false, who)).status,
          who === "adminA" ? 404 : status,
        );
      }
      assert.equal((await request("/admin/reviews", "customerA")).status, 403);
      const row = await review();
      assert.equal((await visible(row.id, false, "ownerA")).status, 403);
      assert.equal((await visible(row.id, false, "customerA")).status, 403);
      assert.equal((await cache()).actual_count, 1);
      await pool.query("UPDATE users SET status='suspended' WHERE id=$1", [
        ids.users.customerA,
      ]);
      try {
        assert.equal((await post(ids.bookings.completed)).status, 403);
      } finally {
        await pool.query("UPDATE users SET status='active' WHERE id=$1", [
          ids.users.customerA,
        ]);
      }
    },
  );
  await t.test(
    "only owned completed booking; manual null disallowed and manual linked Customer allowed",
    async () => {
      for (const id of [
        v7(),
        ids.bookings.pending,
        ids.bookings.submitted,
        ids.bookings.rejected,
        ids.bookings.cash,
      ]) {
        const response = await post(id);
        assert.equal(response.status, 422);
        assert.equal(
          phase4ErrorEnvelopeSchema.parse(await response.json()).error.code,
          "REVIEW_NOT_ALLOWED",
        );
      }
      assert.equal(
        (await post(ids.bookings.completed, "customerB")).status,
        422,
      );
      const manual = await booking(ids.users.customerA);
      await pool.query("UPDATE bookings SET source='manual' WHERE id=$1", [
        manual,
      ]);
      const row = await review(manual);
      assert.equal(row.customerId, ids.users.customerA);
      assert.equal(row.venueId, ids.venues.a);
      assert.equal(row.comment, null);
      assert.equal(row.isVisible, true);
      assert.equal(row.ownerReply, null);
      await cache();
    },
  );
  await t.test(
    "strict input, trim, rating integer and immutable ownership/visibility/cache",
    async () => {
      const bodies = [
        { rating: "5" },
        { rating: 0 },
        { rating: 6 },
        { rating: 2.5 },
        { comment: "a".repeat(2001) },
        { comment: null },
        { venueId: ids.venues.b },
        { customerId: ids.users.customerB },
        { isVisible: false },
        { ownerReply: "fake" },
        { ratingAvg: 5 },
        { reviewCount: 99 },
        { status: "approved" },
      ];
      for (const body of bodies)
        assert.equal(
          (await post(ids.bookings.legacy, "customerA", body)).status,
          400,
        );
      assert.equal((await post("bad-id")).status, 400);
      assert.equal(
        (
          await request("/reviews?ownerId=x", "customerA", "POST", {
            bookingId: ids.bookings.legacy,
            rating: 5,
          })
        ).status,
        400,
      );
      const trimmed = await review(ids.bookings.legacy, "customerA", {
        comment: "  Nội dung  ",
      });
      assert.equal(trimmed.comment, "Nội dung");
      const blank = await review(ids.bookings.completed, "customerA", {
        comment: "   ",
      });
      assert.equal(blank.comment, null);
      await cache();
    },
  );
  await t.test(
    "duplicate requests use DB unique: one 201 and one contract 409, no extra cache increment",
    async () => {
      const results = await Promise.all([
        post(ids.bookings.legacy),
        post(ids.bookings.legacy),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      const duplicate = results.find((r) => r.status === 409)!;
      assert.equal(
        phase4ErrorEnvelopeSchema.parse(await duplicate.json()).error.code,
        "ALREADY_EXISTS",
      );
      assert.equal((await cache()).actual_count, 1);
      // Verify the last line of defence directly, independent of service serialization.
      await assert.rejects(
        () =>
          pool.query(
            `INSERT INTO reviews(id,booking_id,venue_id,customer_id,rating)
      VALUES($1,$2,$3,$4,3)`,
            [v7(), ids.bookings.legacy, ids.venues.a, ids.users.customerA],
          ),
        (error: unknown) =>
          !!error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505",
      );
    },
  );
  await t.test(
    "two Customers on one Venue serialize on its real lock and round visible average to two decimals",
    async () => {
      const a = await booking(ids.users.customerA),
        b = await booking(ids.users.customerB),
        c = await booking(ids.users.customerA);
      const original = repo.create.bind(repo);
      let release!: () => void, entered!: () => void;
      const ready = new Promise<void>((r) => {
          entered = r;
        }),
        gate = new Promise<void>((r) => {
          release = r;
        });
      let used = false;
      repo.create = async (...args) => {
        if (!used) {
          used = true;
          entered();
          await gate;
        }
        return original(...args);
      };
      const first = post(a, "customerA", { rating: 5 });
      let second: Promise<Response> | undefined;
      try {
        await Promise.race([
          ready,
          new Promise((_, reject) =>
            setTimeout(() => reject(Error("gate timeout")), 5000),
          ),
        ]);
        second = post(b, "customerB", { rating: 4 });
        let blocked = false;
        for (let n = 0; n < 100; n++) {
          const locks = await pool.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%venues%'",
          );
          if (locks.rows[0].n) {
            blocked = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 10));
        }
        assert.ok(
          blocked,
          "second Customer waits on Venue UPDATE lock, not a mock",
        );
        release();
        assert.equal((await first).status, 201);
        assert.equal((await second).status, 201);
        await review(c, "customerA", { rating: 4 });
        const value = await cache();
        assert.equal(value.actual_avg, 4.33);
        assert.equal(value.actual_count, 3);
      } finally {
        release();
        await first;
        if (second) await second;
        repo.create = original;
      }
    },
  );
  await t.test(
    "public projection/pagination, Admin hidden filter and strict boolean input",
    async () => {
      const a = await review();
      const b = await review(ids.bookings.completed);
      assert.equal((await visible(b.id, false)).status, 200);
      const response = await request(`/venues/${ids.venues.a}/reviews?limit=1`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const page = phase4ListEnvelope(reviewPublicSchema).parse(
        await response.json(),
      );
      assert.equal(page.meta.total, 1);
      assert.equal(page.data[0]!.id, a.id);
      for (const key of [
        "customerId",
        "bookingId",
        "isVisible",
        "updatedAt",
        "content",
        "email",
        "phone",
      ])
        assert.ok(!(key in page.data[0]!));
      const admin = phase4ListEnvelope(reviewAdminSchema).parse(
        await (
          await request(
            `/admin/reviews?isVisible=false&venueId=${ids.venues.a}`,
            "adminA",
          )
        ).json(),
      );
      assert.equal(admin.meta.total, 1);
      assert.equal(admin.data[0]!.id, b.id);
      assert.equal(
        phase4ListEnvelope(reviewAdminSchema).parse(
          await (await request("/admin/reviews", "adminA")).json(),
        ).meta.total,
        2,
      );
      for (const suffix of [
        "isVisible=0",
        "isVisible=TRUE",
        "isVisible=",
        "isVisible=true&isVisible=false",
        "limit=101",
        "page=0",
        "venueId=bad",
        "customerId=x",
      ])
        assert.equal(
          (await request(`/admin/reviews?${suffix}`, "adminA")).status,
          400,
        );
      for (const suffix of ["isVisible=false", "limit=101", "page=0"])
        assert.equal(
          (await request(`/venues/${ids.venues.a}/reviews?${suffix}`)).status,
          400,
        );
      const empty = phase4ListEnvelope(reviewPublicSchema).parse(
        await (
          await request(`/venues/${ids.venues.a}/reviews?page=9007199254740991`)
        ).json(),
      );
      assert.equal(empty.meta.total, 1);
      assert.deepEqual(empty.data, []);
      assert.equal((await request("/venues/bad/reviews")).status, 400);
      await cache();
    },
  );
  await t.test(
    "completed history permits review on hidden/deleted Venue, public is 404; Admin keeps history",
    async () => {
      for (const status of ["pending", "rejected", "suspended"]) {
        await pool.query("UPDATE venues SET status=$2 WHERE id=$1", [
          ids.venues.a,
          status,
        ]);
        assert.equal(
          (await request(`/venues/${ids.venues.a}/reviews`)).status,
          404,
        );
      }
      await pool.query("UPDATE venues SET deleted_at=now() WHERE id=$1", [
        ids.venues.a,
      ]);
      const row = await review();
      assert.equal((await visible(row.id, false)).status, 200);
      assert.equal(
        (await request(`/venues/${ids.venues.a}/reviews`)).status,
        404,
      );
      assert.equal(
        phase4ListEnvelope(reviewAdminSchema).parse(
          await (
            await request(`/admin/reviews?venueId=${ids.venues.a}`, "adminA")
          ).json(),
        ).meta.total,
        1,
      );
      await pool.query(
        "UPDATE venues SET status='approved',deleted_at=NULL WHERE id=$1",
        [ids.venues.a],
      );
      assert.equal((await request(`/venues/${v7()}/reviews`)).status, 404);
      await cache();
    },
  );
  await t.test(
    "visibility retry is no-op; opposite Admin decisions keep cache and audit consistent",
    async () => {
      const row = await review();
      const path = `/reviews/${row.id}/visibility`;
      assert.equal(
        (await request(path, "adminA", "PATCH", { isVisible: "false" })).status,
        400,
      );
      assert.equal(
        (
          await request(path, "adminA", "PATCH", {
            isVisible: false,
            customerId: ids.users.customerA,
          })
        ).status,
        400,
      );
      const first = phase4DataEnvelope(reviewAdminSchema).parse(
        await (await visible(row.id, false)).json(),
      ).data;
      const retry = phase4DataEnvelope(reviewAdminSchema).parse(
        await (await visible(row.id, false)).json(),
      ).data;
      assert.equal(first.updatedAt, retry.updatedAt);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM audit_logs WHERE entity_id=$1",
            [row.id],
          )
        ).rows[0].n,
        1,
      );
      assert.equal((await cache()).actual_avg, 0);
      assert.equal((await cache()).actual_count, 0);
      const results = await Promise.all([
        visible(row.id, true, "adminA"),
        visible(row.id, false, "adminB"),
      ]);
      assert.ok(results.every((r) => r.status === 200));
      await cache();
      const logs = (
        await pool.query(
          "SELECT old_data,new_data FROM audit_logs WHERE entity_id=$1 ORDER BY created_at,id",
          [row.id],
        )
      ).rows;
      for (const log of logs) {
        assert.deepEqual(Object.keys(log.old_data), ["isVisible"]);
        assert.deepEqual(Object.keys(log.new_data), ["isVisible"]);
      }
      assert.equal((await visible(v7(), false)).status, 404);
      assert.equal((await visible("bad", false)).status, 400);
    },
  );
  await t.test(
    "audit or INSERT failure rolls back visibility/review and trigger cache",
    async () => {
      const row = await review();
      await pool.query(`CREATE FUNCTION reject_review_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='review.visibility_changed' THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_review_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_review_audit()`);
      try {
        assert.equal((await visible(row.id, false)).status, 500);
        assert.equal((await cache()).actual_count, 1);
        assert.equal(
          (
            await pool.query("SELECT is_visible FROM reviews WHERE id=$1", [
              row.id,
            ])
          ).rows[0].is_visible,
          true,
        );
      } finally {
        await pool.query(
          "DROP TRIGGER reject_review_audit ON audit_logs; DROP FUNCTION reject_review_audit()",
        );
      }
      await pool.query(`CREATE FUNCTION reject_review_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test'; END $$;
      CREATE TRIGGER reject_review_insert AFTER INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION reject_review_insert()`);
      try {
        const response = await post(ids.bookings.completed);
        assert.equal(response.status, 500);
        const error = JSON.stringify(await response.json());
        assert.ok(!/INSERT INTO|test|password|query:|params:/i.test(error));
        assert.equal((await cache()).actual_count, 1);
      } finally {
        await pool.query(
          "DROP TRIGGER reject_review_insert ON reviews; DROP FUNCTION reject_review_insert()",
        );
      }
    },
  );
  await t.test(
    "demotion/suspend after guard before transaction blocks mutation with old cookie",
    async () => {
      const row = await review();
      const original = repo.transaction.bind(repo);
      let used = false;
      for (const kind of ["customer-role", "admin-status"]) {
        used = false;
        repo.transaction = async (work) => {
          if (!used) {
            used = true;
            await pool.query(
              kind === "customer-role"
                ? "UPDATE users SET role='owner' WHERE id=$1"
                : "UPDATE users SET status='suspended' WHERE id=$1",
              [
                kind === "customer-role"
                  ? ids.users.customerA
                  : ids.users.adminA,
              ],
            );
          }
          return original(work);
        };
        try {
          assert.equal(
            (
              await (kind === "customer-role"
                ? post(ids.bookings.completed)
                : visible(row.id, false))
            ).status,
            403,
          );
        } finally {
          repo.transaction = original;
          await pool.query(
            "UPDATE users SET role='customer',status='active' WHERE id=$1",
            [ids.users.customerA],
          );
          await pool.query("UPDATE users SET status='active' WHERE id=$1", [
            ids.users.adminA,
          ]);
        }
      }
      assert.equal((await cache()).actual_count, 1);
    },
  );
  await t.test(
    "public count and rows share a snapshot while moderation commits",
    async () => {
      const row = await review();
      const original = repo.publicVenue.bind(repo);
      let used = false;
      repo.publicVenue = async (tx, id) => {
        const result = await original(tx, id);
        if (!used) {
          used = true;
          assert.equal((await visible(row.id, false)).status, 200);
        }
        return result;
      };
      try {
        const result = phase4ListEnvelope(reviewPublicSchema).parse(
          await (await request(`/venues/${ids.venues.a}/reviews`)).json(),
        );
        assert.equal(result.meta.total, 1);
        assert.equal(result.data.length, 1);
      } finally {
        repo.publicVenue = original;
      }
      const result = phase4ListEnvelope(reviewPublicSchema).parse(
        await (await request(`/venues/${ids.venues.a}/reviews`)).json(),
      );
      assert.equal(result.meta.total, 0);
      assert.deepEqual(result.data, []);
      await cache();
    },
  );
  await t.test(
    "Swagger request/response properties and roles match Phase4 OpenAPI",
    async () => {
      const doc = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addCookieAuth("access_token").build(),
      );
      const designUrl = new URL(
        "../../../../docs/openapi/phase-04.openapi.json",
        import.meta.url,
      );
      const design = existsSync(designUrl)
        ? JSON.parse(await readFile(designUrl, "utf8"))
        : null;
      if (design) {
        assert.deepEqual(
          reviewPublicOpenApi,
          design.components.schemas.ReviewPublic,
        );
        assert.deepEqual(
          reviewAdminOpenApi,
          design.components.schemas.ReviewAdmin,
        );
      }
      for (const [path, method, status] of [
        ["/reviews", "post", "201"],
        ["/venues/{id}/reviews", "get", "200"],
        ["/admin/reviews", "get", "200"],
        ["/reviews/{id}/visibility", "patch", "200"],
      ] as const) {
        const op = doc.paths[`/api/v1${path}`]?.[method];
        assert.ok(op);
        assert.ok(op.responses[status]);
        if (path !== "/venues/{id}/reviews")
          assert.ok(op.security?.some((s) => "access_token" in s));
        if (design) {
          const parameters = op.parameters ?? [];
          assert.deepEqual(
            parameters.map((p) => ("name" in p ? p.name : "")).sort(),
            design.paths[path][method].parameters
              .map((p: { name: string }) => p.name)
              .sort(),
          );
        }
      }
    },
  );
}
