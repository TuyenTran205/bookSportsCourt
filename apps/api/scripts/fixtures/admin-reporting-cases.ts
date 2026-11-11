import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import { v7 } from "uuid";
import { phase4FixtureIds as ids } from "./phase4.fixture.js";
import {
  adminStatsSchema,
  bookingAdminSchema,
  phase4DataEnvelope,
  phase4ListEnvelope,
  phase4ErrorEnvelopeSchema,
} from "../../../../packages/shared/src/phase4-responses.js";
import { AdminReportingRepository } from "../../src/modules/admin/admin-reporting.repository.js";
import { existsSync } from "node:fs";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { readFile } from "node:fs/promises";
type Request = (
  path: string,
  who?: string,
  method?: string,
  body?: unknown,
) => Promise<Response>;
export async function runAdminReportingCases(
  t: TestContext,
  app: INestApplication,
  pool: Pool,
  request: Request,
) {
  const repo = app.get(AdminReportingRepository);
  const add = async (
    key: string,
    start: string,
    status: string,
    amount: number,
    paid: string | null,
    refund: number | null = null,
    refunded: string | null = null,
    paymentStatus = "completed",
  ) => {
    const bookingId = v7(),
      paymentId = v7();
    await pool.query(
      "INSERT INTO bookings(id,court_id,customer_id,during,status,total_price,deposit_amount) VALUES($1,$2,$3,tstzrange($4::timestamptz,$4::timestamptz+interval '30 minutes','[)'),$5,100000,50000)",
      [bookingId, ids.courts.a, ids.users.customerA, start, status],
    );
    await pool.query(
      "INSERT INTO payments(id,booking_id,amount,transfer_code,status,paid_at,refund_amount,refunded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        paymentId,
        bookingId,
        amount,
        `REPORT-${key}`,
        paymentStatus,
        paid,
        refund,
        refunded,
      ],
    );
    return { bookingId, paymentId };
  };
  const before = await add(
    "before",
    "2035-01-30T16:30:00Z",
    "completed",
    10000,
    "2035-01-30T16:59:59Z",
  );
  const start = await add(
    "start",
    "2035-01-30T17:00:00Z",
    "no_show",
    30000,
    "2035-01-30T17:00:00Z",
  );
  const end = await add(
    "end",
    "2035-01-31T17:00:00Z",
    "confirmed",
    20000,
    "2035-01-31T17:00:00Z",
  );
  await add(
    "late-refund",
    "2034-12-01T01:00:00Z",
    "cancelled",
    40000,
    "2034-12-31T16:59:59Z",
    35000,
    "2035-01-29T17:00:00Z",
    "refunded",
  );
  await add(
    "no-refund-amount",
    "2034-12-02T01:00:00Z",
    "cancelled",
    60000,
    "2035-01-31T00:00:00Z",
    null,
    "2035-01-31T01:00:00Z",
    "refunded",
  );
  await add(
    "no-refund-date",
    "2034-12-03T01:00:00Z",
    "cancelled",
    70000,
    "2035-01-30T17:00:00Z",
    20000,
    null,
    "refunded",
  );
  await add(
    "no-paid-date",
    "2034-12-04T01:00:00Z",
    "cancelled",
    80000,
    null,
    15000,
    "2035-01-30T17:00:00Z",
    "refunded",
  );
  await add(
    "missing-both-flows",
    "2034-12-05T01:00:00Z",
    "cancelled",
    90000,
    null,
    null,
    null,
    "refunded",
  );
  await pool.query("UPDATE bookings SET guest_phone='0901234567' WHERE id=$1", [
    ids.bookings.cash,
  ]);
  await pool.query(
    "INSERT INTO payments(id,booking_id,amount,transfer_code,status,created_at) VALUES($1,$2,99999,'REPORT-old-attempt','rejected','2050-01-01T00:00:00Z')",
    [v7(), ids.bookings.completed],
  );
  const list = async (query: string) => {
    const response = await request("/admin/bookings?" + query, "adminA");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    return phase4ListEnvelope(bookingAdminSchema).parse(await response.json());
  };
  const stats = async (query: string) => {
    const response = await request("/admin/stats?" + query, "adminA");
    assert.equal(response.status, 200);
    return phase4DataEnvelope(adminStatsSchema).parse(await response.json())
      .data;
  };
  await t.test(
    "Admin role, revoked/inactive principal and strict bounded date/query validation",
    async () => {
      for (const endpoint of ["/admin/bookings", "/admin/stats"]) {
        assert.equal((await request(endpoint)).status, 401);
        for (const who of ["ownerA", "customerA"])
          assert.equal((await request(endpoint, who)).status, 403);
      }
      for (const endpoint of ["/admin/bookings", "/admin/stats"])
        for (const q of [
          "from=2035-01-01",
          "to=2035-01-02",
          "from=2035-02-29&to=2035-03-01",
          "from=0000-01-01&to=0000-01-02",
          "from=2035-02-02&to=2035-02-01",
          "from=2036-01-01&to=2037-01-01",
          "from=2035-01-01&from=2035-01-02&to=2035-01-03",
          "extra=x",
        ]) {
          const response = await request(endpoint + "?" + q, "adminA");
          assert.equal(response.status, 400);
          phase4ErrorEnvelopeSchema.parse(await response.json());
        }
      for (const q of [
        "status=invalid",
        "venueId=bad",
        "customerId=null",
        "page=1x",
        "limit=101",
      ])
        assert.equal(
          (await request("/admin/bookings?" + q, "adminA")).status,
          400,
        );
      assert.equal(
        (await request("/admin/stats?groupBy=year", "adminA")).status,
        400,
      );
      for (const year of ["0001", "9999"])
        assert.equal(
          (
            await request(
              `/admin/stats?from=${year}-01-01&to=${year}-01-01`,
              "adminA",
            )
          ).status,
          200,
        );
      await pool.query("UPDATE users SET status='suspended' WHERE id=$1", [
        ids.users.adminA,
      ]);
      try {
        assert.equal((await request("/admin/stats", "adminA")).status, 403);
      } finally {
        await pool.query("UPDATE users SET status='active' WHERE id=$1", [
          ids.users.adminA,
        ]);
      }
    },
  );
  await t.test(
    "booking filter uses start at Vietnam midnight; every filter and combined scope counts correctly",
    async () => {
      const only = await list("from=2035-01-31&to=2035-01-31");
      assert.equal(only.meta.total, 1);
      assert.equal(only.data[0]!.id, start.bookingId);
      assert.equal(only.data[0]!.start, "2035-01-30T17:00:00.000Z");
      assert.ok(
        !only.data.some((row) =>
          [before.bookingId, end.bookingId].includes(row.id),
        ),
      );
      const both = await list(
        `from=2035-01-01&to=2035-02-05&status=completed&venueId=${ids.venues.b}&customerId=${ids.users.customerB}`,
      );
      assert.equal(both.meta.total, 1);
      assert.equal(both.data[0]!.id, ids.bookings.completedB);
      for (const status of [
        "held",
        "pending_payment",
        "completed",
        "cancelled",
        "expired",
        "confirmed",
        "no_show",
      ]) {
        const rows = await list(
          `from=2035-01-01&to=2035-02-05&status=${status}`,
        );
        assert.ok(rows.meta.total >= 1);
        assert.ok(rows.data.every((row) => row.status === status));
      }
      const absent = await list(
        `from=2035-01-01&to=2035-02-05&venueId=${ids.venues.b}&customerId=${ids.users.customerA}`,
      );
      assert.equal(absent.meta.total, 0);
      assert.equal(absent.meta.totalPages, 0);
    },
  );
  await t.test(
    "pagination stays stable without payment fanout; safe public projection and nullable/manual rows",
    async () => {
      const q = "from=2035-01-01&to=2035-02-05";
      const all = await list(q + "&limit=100"),
        first = await list(q + "&limit=2"),
        second = await list(q + "&limit=2&page=2");
      assert.deepEqual(
        [...first.data, ...second.data].map((row) => row.id),
        all.data.slice(0, 4).map((row) => row.id),
      );
      assert.equal(new Set(all.data.map((row) => row.id)).size, all.meta.total);
      const completed = all.data.find(
        (row) => row.id === ids.bookings.completed,
      )!;
      assert.equal(completed.payment!.id, ids.payments.completed);
      assert.equal(completed.payment!.amount, 50000);
      const manual = all.data.find((row) => row.id === ids.bookings.cash)!;
      assert.equal(manual.customerId, null);
      assert.equal(manual.source, "manual");
      assert.equal(manual.guestPhoneMasked, "*******567");
      assert.equal(
        all.data.find((row) => row.id === ids.bookings.reviewTwo)!.payment,
        null,
      );
      for (const row of all.data) {
        for (const key of [
          "guestPhone",
          "note",
          "createdBy",
          "cancelledBy",
          "proofUrl",
          "bankAccount",
        ])
          assert.equal(key in row, false);
        if (row.payment)
          for (const key of [
            "proofUrl",
            "proofObjectKey",
            "transferCode",
            "bankAccount",
          ])
            assert.equal(key in row.payment, false);
      }
      const out = await list(q + "&page=9007199254740991&limit=100");
      assert.deepEqual(out.data, []);
      assert.equal(out.meta.total, all.meta.total);
    },
  );
  await t.test(
    "daily gross/refunds use independent timestamps, cash/deposit values, negative net and unique legacy quality count",
    async () => {
      const jan = await stats("from=2035-01-01&to=2035-01-01");
      assert.equal(jan.summary.grossRevenue, 150000);
      assert.equal(jan.summary.refundedAmount, 0);
      assert.equal(jan.summary.bookingCountsByStatus.held, 1); // paidAt does not follow booking date.
      const cash = await stats("from=2035-01-08&to=2035-01-08");
      assert.equal(cash.summary.bookingCountsByStatus.completed, 1);
      assert.equal(cash.summary.grossRevenue, 0); // cash paid Jan1, booking Jan8.
      const negative = await stats("from=2035-01-30&to=2035-01-30");
      assert.equal(negative.summary.grossRevenue, 10000);
      assert.equal(negative.summary.refundedAmount, 35000);
      assert.equal(negative.summary.netRevenue, -25000);
      const day = await stats("from=2035-01-31&to=2035-01-31");
      assert.equal(day.summary.grossRevenue, 160000);
      assert.equal(day.summary.refundedAmount, 15000);
      assert.equal(day.summary.netRevenue, 145000);
      assert.equal(day.summary.bookingCountsByStatus.no_show, 1);
      assert.equal(day.summary.bookingCountsByStatus.confirmed, 0);
      assert.equal(day.dataQuality.excludedPaymentCount, 5);
      assert.equal(day.series.length, 1);
      assert.equal(day.series[0]!.netRevenue, 145000);
      const full = await stats("from=2035-01-30&to=2035-01-31");
      assert.equal(full.summary.grossRevenue, 170000);
      assert.equal(full.summary.refundedAmount, 50000);
      assert.equal(full.summary.netRevenue, 120000);
    },
  );
  await t.test(
    "Vietnam week/month buckets are filled, clip flows to requested dates and keep summary consistent",
    async () => {
      const weekly = await stats("from=2035-01-31&to=2035-02-06&groupBy=week");
      assert.deepEqual(
        weekly.series.map((row) => row.date),
        ["2035-01-29", "2035-02-05"],
      );
      assert.equal(weekly.summary.grossRevenue, 230000);
      assert.equal(weekly.summary.refundedAmount, 40000);
      assert.equal(weekly.summary.netRevenue, 190000);
      assert.equal(weekly.series[1]!.grossRevenue, 0);
      assert.equal(weekly.series[1]!.bookingCountsByStatus.completed, 0);
      const monthly = await stats(
        "from=2035-01-31&to=2035-02-01&groupBy=month",
      );
      assert.deepEqual(
        monthly.series.map((row) => row.date),
        ["2035-01-01", "2035-02-01"],
      );
      assert.equal(monthly.series[0]!.grossRevenue, 160000);
      assert.equal(monthly.series[1]!.grossRevenue, 70000);
      for (const response of [weekly, monthly]) {
        assert.equal(
          response.summary.grossRevenue,
          response.series.reduce((sum, row) => sum + row.grossRevenue, 0),
        );
        assert.equal(
          response.summary.refundedAmount,
          response.series.reduce((sum, row) => sum + row.refundedAmount, 0),
        );
      }
      const leap = await stats("from=2036-01-01&to=2036-12-31");
      assert.equal(leap.series.length, 366);
      assert.equal(leap.summary.grossRevenue, 0);
      assert.ok(leap.series.every((row) => row.netRevenue === 0));
      assert.equal(leap.dataQuality.excludedPaymentCount, 5);
    },
  );
  await t.test(
    "default Vietnam month, global populations and soft-deleted Venue/Court history remain distinct",
    async () => {
      const defaultStats = await stats("");
      const vn = new Date(Date.parse(defaultStats.generatedAt) + 7 * 3600000)
        .toISOString()
        .slice(0, 7);
      assert.equal(defaultStats.from, `${vn}-01`);
      const jan = await stats("from=2035-01-31&to=2035-01-31");
      assert.deepEqual(
        defaultStats.summary.userCountsByRole,
        jan.summary.userCountsByRole,
      );
      assert.deepEqual(
        defaultStats.summary.venueCountsByStatus,
        jan.summary.venueCountsByStatus,
      );
      await pool.query(
        "UPDATE venues SET status='suspended',deleted_at=clock_timestamp() WHERE id=$1",
        [ids.venues.a],
      );
      await pool.query(
        "UPDATE courts SET deleted_at=clock_timestamp() WHERE id=$1",
        [ids.courts.a],
      );
      try {
        const rows = await list(
          `from=2035-01-31&to=2035-01-31&venueId=${ids.venues.a}`,
        );
        assert.equal(rows.meta.total, 1);
        const after = await stats("from=2035-01-31&to=2035-01-31");
        assert.equal(after.summary.grossRevenue, jan.summary.grossRevenue);
        assert.equal(after.summary.bookingCountsByStatus.no_show, 1);
        assert.equal(
          after.summary.venueCountsByStatus.approved,
          jan.summary.venueCountsByStatus.approved - 1,
        );
      } finally {
        await pool.query(
          "UPDATE venues SET status='approved',deleted_at=NULL WHERE id=$1",
          [ids.venues.a],
        );
        await pool.query("UPDATE courts SET deleted_at=NULL WHERE id=$1", [
          ids.courts.a,
        ]);
      }
    },
  );
  await t.test(
    "booking count/page and statistical series/populations use one real repeatable-read snapshot",
    async () => {
      const original = repo.bookingRows.bind(repo);
      let inserted: string | undefined;
      repo.bookingRows = async (tx, query, range) => {
        if (!inserted) {
          inserted = v7();
          await pool.query(
            "INSERT INTO bookings(id,court_id,source,guest_name,during,status,total_price,deposit_amount) VALUES($1,$2,'manual','snapshot guest',tstzrange('2035-01-31T02:00Z','2035-01-31T02:30Z','[)'),'completed',100000,50000)",
            [inserted, ids.courts.a],
          );
        }
        return original(tx, query, range);
      };
      try {
        const old = await list("from=2035-01-31&to=2035-01-31");
        assert.equal(old.meta.total, 1);
        assert.equal(old.data.length, 1);
      } finally {
        repo.bookingRows = original;
      }
      assert.equal((await list("from=2035-01-31&to=2035-01-31")).meta.total, 2);
      await pool.query("DELETE FROM bookings WHERE id=$1", [inserted]);
      const baseline = await stats("from=2035-01-31&to=2035-01-31"),
        money = repo.moneyFlows.bind(repo),
        extraUser = v7();
      let changed = false;
      repo.moneyFlows = async (tx, range, group) => {
        if (!changed) {
          changed = true;
          await pool.query("UPDATE payments SET amount=amount+1 WHERE id=$1", [
            start.paymentId,
          ]);
          await pool.query(
            "INSERT INTO users(id,email,full_name) VALUES($1,$2,'snapshot extra')",
            [extraUser, `${extraUser}@test.example`],
          );
        }
        return money(tx, range, group);
      };
      try {
        const snapshot = await stats("from=2035-01-31&to=2035-01-31");
        assert.deepEqual(snapshot.summary, baseline.summary);
      } finally {
        repo.moneyFlows = money;
        await pool.query("UPDATE payments SET amount=amount-1 WHERE id=$1", [
          start.paymentId,
        ]);
        await pool.query("DELETE FROM users WHERE id=$1", [extraUser]);
      }
    },
  );
  await t.test(
    "SQL indexes exist, range predicates are indexable and Swagger matches shared/design response",
    async () => {
      const names = [
        "idx_bookings_start",
        "idx_payments_collected_at",
        "idx_payments_refunded_at",
      ];
      const indexes = await pool.query(
        "SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND indexname=ANY($1)",
        [names],
      );
      assert.equal(indexes.rowCount, 3);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL enable_seqscan=off");
        for (const [table, expression, index] of [
          [
            "bookings",
            "lower(during)>= '2035-01-30T17:00Z'::timestamptz AND lower(during)<'2035-01-31T17:00Z'::timestamptz",
            names[0],
          ],
          [
            "payments",
            "status IN ('completed','refunded') AND paid_at>='2035-01-30T17:00Z'::timestamptz AND paid_at<'2035-01-31T17:00Z'::timestamptz",
            names[1],
          ],
          [
            "payments",
            "status='refunded' AND refund_amount IS NOT NULL AND refunded_at>='2035-01-30T17:00Z'::timestamptz AND refunded_at<'2035-01-31T17:00Z'::timestamptz",
            names[2],
          ],
        ]) {
          const plan = await client.query(
            `EXPLAIN (FORMAT JSON) SELECT * FROM ${table} WHERE ${expression}`,
          );
          assert.ok(JSON.stringify(plan.rows).includes(index!));
        }
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      for (const path of ["/api/v1/admin/bookings", "/api/v1/admin/stats"])
        assert.ok(document.paths[path]?.get);
      const specUrl = new URL(
        "../../../../docs/openapi/phase-04.openapi.json",
        import.meta.url,
      );
      if (existsSync(specUrl)) {
        const spec = JSON.parse(await readFile(specUrl, "utf8"));
        const response = document.paths["/api/v1/admin/stats"]!.get!.responses[
          "200"
        ] as unknown as {
          content: Record<
            string,
            { schema: { properties: { data: { required: string[] } } } }
          >;
        };
        assert.deepEqual(
          response.content[
            "application/json"
          ]!.schema.properties.data.required.sort(),
          spec.components.schemas.AdminStats.required.sort(),
        );
      }
    },
  );
}
