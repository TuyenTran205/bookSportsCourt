import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import { v7 } from "uuid";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { OwnerApplicationsRepository } from "../../src/modules/owner-applications/owner-applications.repository.js";
import {
  ownerApplicationViewSchema,
  phase4DataEnvelope,
  phase4ListEnvelope,
  phase4ErrorEnvelopeSchema,
} from "../../../../packages/shared/src/phase4-responses.js";
import { phase4FixtureIds as ids } from "./phase4.fixture.js";
type Request = (
  path: string,
  who?: string,
  method?: string,
  body?: unknown,
) => Promise<Response>;

export async function runOwnerApplicationCases(
  t: TestContext,
  app: INestApplication,
  pool: Pool,
  request: Request,
) {
  const repo = app.get(OwnerApplicationsRepository),
    id = ids.applications.pending,
    target = ids.users.customerA;
  const route = `/admin/owner-applications/${id}`;
  const decode = async (response: Response) =>
    phase4DataEnvelope(ownerApplicationViewSchema).parse(await response.json())
      .data;
  const reset = async () => {
    await pool.query("DELETE FROM audit_logs WHERE entity_id=$1", [id]);
    await pool.query(
      "UPDATE users SET role='customer',status='active',deleted_at=NULL WHERE id=$1",
      [target],
    );
    await pool.query(
      "UPDATE owner_applications SET status='pending',review_note=NULL,reviewed_by=NULL,reviewed_at=NULL WHERE id=$1",
      [id],
    );
  };
  const row = async () =>
    (
      await pool.query(
        "SELECT a.*,u.role,u.session_version FROM owner_applications a JOIN users u ON u.id=a.user_id WHERE a.id=$1",
        [id],
      )
    ).rows[0];
  const auditCount = async () =>
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM audit_logs WHERE entity_id=$1",
        [id],
      )
    ).rows[0].n;
  await t.test(
    "Admin list uses strict query, default pending, safe pagination and allowlisted PII projection",
    async () => {
      await reset();
      assert.equal((await request("/admin/owner-applications")).status, 401);
      for (const who of ["customerA", "ownerA"]) {
        assert.equal(
          (await request("/admin/owner-applications", who)).status,
          403,
        );
        assert.equal(
          (await request(route, who, "PATCH", { status: "approved" })).status,
          403,
        );
      }
      for (const query of [
        "status=invalid",
        "page=1x",
        "limit=101",
        "page=0",
        "status=pending&status=approved",
        "q=person",
      ])
        assert.equal(
          (await request("/admin/owner-applications?" + query, "adminA"))
            .status,
          400,
        );
      const response = await request(
        "/admin/owner-applications?limit=1",
        "adminA",
      );
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      const list = phase4ListEnvelope(ownerApplicationViewSchema).parse(
        await response.json(),
      );
      assert.equal(list.meta.total, 1);
      assert.equal(list.data[0]!.id, id);
      assert.equal(list.data[0]!.taxCode, "0123456789");
      for (const field of [
        "applicant",
        "email",
        "avatarUrl",
        "passwordHash",
        "sessionVersion",
        "documentUrl",
      ])
        assert.ok(!(field in list.data[0]!));
      const empty = phase4ListEnvelope(ownerApplicationViewSchema).parse(
        await (
          await request(
            "/admin/owner-applications?page=9007199254740991&limit=100",
            "adminA",
          )
        ).json(),
      );
      assert.deepEqual(empty.data, []);
      await pool.query(
        "UPDATE owner_applications SET status='rejected' WHERE id=$1",
        [id],
      );
      const none = phase4ListEnvelope(ownerApplicationViewSchema).parse(
        await (await request("/admin/owner-applications", "adminA")).json(),
      );
      assert.equal(none.meta.total, 0);
      assert.equal(none.meta.totalPages, 0);
    },
  );
  await t.test(
    "validation, missing resource precedence and applicant state conflicts never grant role",
    async () => {
      await reset();
      const invalid = await request(route, "adminA", "PATCH", {
        status: "rejected",
      });
      assert.equal(invalid.status, 400);
      phase4ErrorEnvelopeSchema.parse(await invalid.json());
      assert.equal(
        (
          await request(
            "/admin/owner-applications/bad-id",
            "adminA",
            "PATCH",
            {},
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            `/admin/owner-applications/${v7()}`,
            "adminA",
            "PATCH",
            {},
          )
        ).status,
        404,
      );
      for (const body of [
        { status: "pending" },
        { status: "rejected" },
        { status: "rejected", reviewNote: "  " },
        { status: "approved", reviewNote: " " },
        { status: "approved", userId: ids.users.ownerA },
        { status: "approved", reviewNote: "x".repeat(501) },
      ])
        assert.equal(
          (await request(route, "adminA", "PATCH", body)).status,
          400,
        );
      assert.equal(
        (
          await request(route + "?extra=true", "adminA", "PATCH", {
            status: "approved",
          })
        ).status,
        400,
      );
      for (const change of [
        "status='suspended'",
        "status='pending'",
        "deleted_at=clock_timestamp()",
        "role='owner'",
        "role='admin'",
      ]) {
        await reset();
        await pool.query("UPDATE users SET " + change + " WHERE id=$1", [
          target,
        ]);
        assert.equal(
          (await request(route, "adminA", "PATCH", { status: "approved" }))
            .status,
          409,
        );
        assert.equal((await row()).status, "pending");
        assert.equal(await auditCount(), 0);
      }
      await reset();
    },
  );
  await t.test(
    "approval changes live role with old cookie; retry retains reviewer/time/audit; no role resurrection",
    async () => {
      await reset();
      assert.equal((await request("/owner/venues", "customerA")).status, 403);
      const initial = await row();
      const approved = await decode(
        await request(route, "adminA", "PATCH", {
          status: "approved",
          reviewNote: "  Verified  ",
        }),
      );
      assert.equal(approved.reviewNote, "Verified");
      assert.equal(approved.reviewedBy, ids.users.adminA);
      assert.equal((await row()).role, "owner");
      assert.equal((await row()).session_version, initial.session_version);
      assert.equal((await request("/owner/venues", "customerA")).status, 200);
      assert.equal(
        (await request("/owner-applications/me", "customerA")).status,
        200,
      );
      const retry = await decode(
        await request(route, "adminB", "PATCH", {
          status: "approved",
          reviewNote: "Verified",
        }),
      );
      assert.deepEqual(retry, approved);
      assert.equal(await auditCount(), 1);
      for (const input of [
        { status: "rejected", reviewNote: "No" },
        { status: "approved", reviewNote: "Changed" },
      ])
        assert.equal(
          (await request(route, "adminA", "PATCH", input)).status,
          400,
        );
      await pool.query("UPDATE users SET role='customer' WHERE id=$1", [
        target,
      ]);
      assert.equal(
        (
          await request(route, "adminA", "PATCH", {
            status: "approved",
            reviewNote: "Verified",
          })
        ).status,
        400,
      );
      assert.equal((await request("/owner/venues", "customerA")).status, 403);
      const logs = (
        await pool.query(
          "SELECT old_data,new_data FROM audit_logs WHERE entity_id=$1",
          [id],
        )
      ).rows;
      assert.ok(!JSON.stringify(logs).includes("Verified"));
      assert.ok(!JSON.stringify(logs).includes("0123456789"));
    },
  );
  await t.test(
    "rejection is idempotent by normalized note and never grants owner",
    async () => {
      await reset();
      const first = await decode(
        await request(route, "adminA", "PATCH", {
          status: "rejected",
          reviewNote: "  Incomplete  ",
        }),
      );
      assert.equal(first.status, "rejected");
      assert.equal((await row()).role, "customer");
      assert.deepEqual(
        await decode(
          await request(route, "adminB", "PATCH", {
            status: "rejected",
            reviewNote: "Incomplete",
          }),
        ),
        first,
      );
      assert.equal(
        (
          await request(route, "adminA", "PATCH", {
            status: "rejected",
            reviewNote: "Other",
          })
        ).status,
        400,
      );
      assert.equal(await auditCount(), 1);
    },
  );
  // Hold at the application row after real user locks. Competitor must wait in PostgreSQL.
  async function race(
    first: () => Promise<Response>,
    second: () => Promise<Response>,
  ) {
    const original = repo.findById.bind(repo);
    let release!: () => void,
      entered!: () => void,
      calls = 0;
    const gate = new Promise<void>((r) => {
        release = r;
      }),
      ready = new Promise<void>((r) => {
        entered = r;
      });
    repo.findById = async (key, tx, lock) => {
      const found = await original(key, tx, lock);
      if (lock && ++calls === 1) {
        entered();
        await gate;
      }
      return found;
    };
    const a = first();
    try {
      await Promise.race([
        ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(Error("gate timeout")), 5000),
        ),
      ]);
      const b = second();
      let blocked = false;
      for (let n = 0; n < 100; n++) {
        const waiting = await pool.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%users%'",
        );
        if (waiting.rows[0].n > 0) {
          blocked = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.ok(blocked, "competitor waits on a real DB lock");
      release();
      return await Promise.all([a, b]);
    } finally {
      release();
      repo.findById = original;
    }
  }
  await t.test(
    "two Admin decisions serialize in both orders; same approval retry writes once",
    async () => {
      for (const firstStatus of ["approved", "rejected"] as const) {
        await reset();
        const secondStatus =
          firstStatus === "approved" ? "rejected" : "approved";
        const result = await race(
          () =>
            request(route, "adminA", "PATCH", {
              status: firstStatus,
              reviewNote: "Decision",
            }),
          () =>
            request(route, "adminB", "PATCH", {
              status: secondStatus,
              reviewNote: "Decision",
            }),
        );
        assert.deepEqual(
          result.map((r) => r.status),
          [200, 400],
        );
        assert.equal((await row()).status, firstStatus);
        assert.equal(
          (await row()).role,
          firstStatus === "approved" ? "owner" : "customer",
        );
        assert.equal(await auditCount(), 1);
      }
      await reset();
      const result = await race(
        () => request(route, "adminA", "PATCH", { status: "approved" }),
        () => request(route, "adminB", "PATCH", { status: "approved" }),
      );
      assert.deepEqual(
        result.map((r) => r.status),
        [200, 200],
      );
      assert.equal(await auditCount(), 1);
    },
  );
  await t.test(
    "Admin demotion/suspension and applicant suspension after guard are rechecked inside transaction",
    async () => {
      for (const [userId, change, expected] of [
        [ids.users.adminA, "role='customer'", 403],
        [ids.users.adminA, "status='suspended'", 403],
        [target, "status='suspended'", 409],
      ] as const) {
        await reset();
        const original = repo.lockUsers.bind(repo);
        let changed = false;
        repo.lockUsers = async (tx, users) => {
          if (!changed) {
            changed = true;
            await pool.query("UPDATE users SET " + change + " WHERE id=$1", [
              userId,
            ]);
          }
          return original(tx, users);
        };
        try {
          assert.equal(
            (await request(route, "adminA", "PATCH", { status: "approved" }))
              .status,
            expected,
          );
          assert.equal((await row()).status, "pending");
          assert.equal(await auditCount(), 0);
        } finally {
          repo.lockUsers = original;
          await pool.query(
            "UPDATE users SET role=$2,status='active' WHERE id=$1",
            [userId, userId === target ? "customer" : "admin"],
          );
        }
      }
    },
  );
  await t.test(
    "audit failure rolls back application and role; retry succeeds without private diagnostics",
    async () => {
      await reset();
      await pool.query(
        "CREATE FUNCTION fail_application_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='" +
          id +
          "' THEN RAISE EXCEPTION 'private application audit failure'; END IF; RETURN NEW; END $$",
      );
      await pool.query(
        "CREATE TRIGGER fail_application_audit_test BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_application_audit_test()",
      );
      try {
        const response = await request(route, "adminA", "PATCH", {
          status: "approved",
        });
        assert.equal(response.status, 500);
        assert.ok(
          !JSON.stringify(await response.json()).includes(
            "private application",
          ),
        );
        assert.equal((await row()).status, "pending");
        assert.equal((await row()).role, "customer");
        assert.equal(await auditCount(), 0);
      } finally {
        await pool.query(
          "DROP TRIGGER fail_application_audit_test ON audit_logs; DROP FUNCTION fail_application_audit_test()",
        );
      }
      assert.equal(
        (await request(route, "adminA", "PATCH", { status: "approved" }))
          .status,
        200,
      );
      assert.equal(await auditCount(), 1);
    },
  );
  await t.test(
    "Customer submit/resubmit preserves history and taxCode; concurrent submits produce one pending row",
    async () => {
      await reset();
      const body = {
        businessName: "  Test business  ",
        phone: "0912345678",
        address: "123 Test Street",
        taxCode: "0123456789012",
      };
      assert.equal(
        (await request("/owner-applications/me", "ownerA")).status,
        404,
      );
      assert.equal(
        (
          await request("/owner-applications", "customerB", "POST", {
            ...body,
            documentUrl: "private",
          })
        ).status,
        400,
      );
      assert.equal(
        (await request("/owner-applications/me", "adminA")).status,
        403,
      );
      assert.equal(
        (await request("/owner-applications", "ownerA", "POST", body)).status,
        403,
      );
      assert.equal(
        (await request("/owner-applications", "customerA", "POST", body))
          .status,
        409,
      );
      // customerB has rejected history and no pending application.
      const submitted = await Promise.all([
        request("/owner-applications", "customerB", "POST", body),
        request("/owner-applications", "customerB", "POST", body),
      ]);
      assert.deepEqual(submitted.map((r) => r.status).sort(), [201, 409]);
      const current = await decode(
        await request("/owner-applications/me", "customerB"),
      );
      assert.notEqual(current.id, ids.applications.rejected);
      assert.equal(current.taxCode, body.taxCode);
      assert.equal(current.businessName, "Test business");
      assert.equal(
        (
          await pool.query(
            "SELECT status FROM owner_applications WHERE id=$1",
            [ids.applications.rejected],
          )
        ).rows[0].status,
        "rejected",
      );
      assert.equal(
        (
          await request(
            `/admin/owner-applications/${current.id}`,
            "adminA",
            "PATCH",
            { status: "approved" },
          )
        ).status,
        200,
      );
      assert.equal((await request("/owner/venues", "customerB")).status, 200);
    },
  );
  await t.test(
    "Swagger and design response agree; Venue moderation route remains available",
    async () => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      for (const [path, method] of [
        ["/api/v1/admin/owner-applications", "get"],
        ["/api/v1/admin/owner-applications/{id}", "patch"],
        ["/api/v1/owner-applications", "post"],
        ["/api/v1/owner-applications/me", "get"],
      ] as const)
        assert.ok(document.paths[path]?.[method]);
      const specUrl = new URL(
        "../../../../docs/openapi/phase-04.openapi.json",
        import.meta.url,
      );
      if (existsSync(specUrl)) {
        const spec = JSON.parse(await readFile(specUrl, "utf8"));
        const response = document.paths[
          "/api/v1/admin/owner-applications/{id}"
        ]!.patch!.responses["200"] as unknown as {
          content: Record<
            string,
            { schema: { properties: { data: { required: string[] } } } }
          >;
        };
        assert.deepEqual(
          response.content[
            "application/json"
          ]!.schema.properties.data.required.sort(),
          spec.components.schemas.OwnerApplicationView.required.sort(),
        );
      }
      assert.ok(document.paths["/api/v1/venues/{id}/status"]?.patch);
    },
  );
}
