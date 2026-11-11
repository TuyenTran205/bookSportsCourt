import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { v7 } from 'uuid';
import { eq } from 'drizzle-orm';
import { writeAudit, projectAuditData } from '../../src/modules/audit/audit-writer.js';
import * as schema from '../../src/database/schema/index.js';
import { auditLogs, venues } from '../../src/database/schema/index.js';
import { venueFixtureIds as ids } from './venues.fixture.js';
import { auditViewSchema, phase4ListEnvelope } from '../../../../packages/shared/src/phase4-responses.js';

type Request = (path: string, who?: string, method?: string, body?: unknown) => Promise<Response>;
export async function runAuditCases(t: TestContext, app: INestApplication, pool: Pool, request: Request) {
  const db = drizzle(pool, { schema });
  const list = async (response: Response) => phase4ListEnvelope(auditViewSchema).parse(await response.json());
  const first = v7(), second = v7(), last = v7();
  for (const [id, at, actorId, action, before] of [
    [first, '2035-01-01T00:00:00Z', ids.users.admin, 'venue.status_changed', { status: 'pending', token: 'must-not-leak', bankAccount: { accountNo: 'must-not-leak' } }],
    [second, '2035-01-01T00:00:00Z', ids.users.admin, 'venue.status_changed', { status: 'approved', hasRejectionReason: false }],
    [last, '2035-01-02T00:00:00Z', null, 'payment.review_expired', null],
  ] as const) {
    await pool.query('INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,old_data,new_data,ip_address,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,\'127.0.0.1\',$8)', [id, actorId, action, actorId ? 'venue' : 'payment', ids.venues.approvedA, before, { status: 'approved', password_hash: 'must-not-leak', reason: 'must-not-leak' }, at]);
  }
  const range = 'from=2035-01-01T00:00:00Z&to=2035-01-02T00:00:00Z';
  await t.test('only active Admin reads logs, with cookie and current database role', async () => {
    for (const [who, status] of [['guest',401],['customer',403],['ownerA',403],['suspendedOwner',403],['admin',200]] as const) assert.equal((await request('/admin/audit-logs?' + range, who)).status, status);
    await pool.query("UPDATE users SET role='customer' WHERE id=$1", [ids.users.admin]);
    assert.equal((await request('/admin/audit-logs', 'admin')).status,403);
    await pool.query("UPDATE users SET role='admin',status='suspended' WHERE id=$1", [ids.users.admin]);
    assert.equal((await request('/admin/audit-logs', 'admin')).status,403);
    await pool.query("UPDATE users SET status='active' WHERE id=$1", [ids.users.admin]);
  });
  await t.test('strict query/date validation rejects repeated values, unsafe pagination and unknown keys', async () => {
    for (const query of ['page=1&page=2','page=1e2','limit=101','actorId=invalid','ownerId=x','from=2035-01-01T00:00:00Z','from=2035-01-02T00:00:00Z&to=2035-01-01T00:00:00Z','from=2035-01-01T00:00:00Z&to=2037-01-01T00:00:00Z']) {
      const response=await request('/admin/audit-logs?' + query, 'admin');
      assert.equal(response.status,400,query);
      assert.equal((await response.json() as {error:{code:string}}).error.code,'VALIDATION_ERROR');
    }
  });
  await t.test('date boundaries, exact filters, stable ordering and safe legacy projection', async () => {
    const response=await request('/admin/audit-logs?' + range + '&limit=1','admin');
    const body=await list(response);
    phase4ListEnvelope(auditViewSchema).parse(body);
    assert.deepEqual(body.meta,{ page:1,limit:1,total:2,totalPages:2 });
    assert.equal(body.data[0]!.id,second);
    const page2=await list(await request('/admin/audit-logs?' + range + '&page=2&limit=1','admin'));
    assert.equal(page2.data[0]!.id,first);
    assert.deepEqual(page2.data[0]!.oldData,{ status:'pending' });
    assert.deepEqual(page2.data[0]!.newData,{ status:'approved' });
    assert.ok(!JSON.stringify(page2).includes('must-not-leak'));
    assert.ok(!JSON.stringify(page2).includes('ipAddress'));
    assert.deepEqual(projectAuditData({ status:'must-not-leak', isVisible:'private text', role:'secret', hasReason:true }),{hasReason:true});
    for (const filter of ['action=%25','action=venue.status_changed%27%20OR%201%3D1--','entityType=unknown']) {
      const empty=await list(await request('/admin/audit-logs?' + range + '&' + filter,'admin'));
      assert.equal(empty.meta.total,0); assert.equal(empty.meta.totalPages,0);
    }
    const filtered=await list(await request('/admin/audit-logs?' + range + '&actorId='+ids.users.admin+'&action=venue.status_changed&entityType=venue','admin'));
    assert.equal(filtered.meta.total,2);
    const beyond=await list(await request('/admin/audit-logs?' + range + '&page=9007199254740991','admin'));
    assert.deepEqual(beyond.data,[]); assert.equal(beyond.meta.total,2);
    const cron=await list(await request('/admin/audit-logs?from=2035-01-02T00:00:00Z&to=2035-01-03T00:00:00Z','admin'));
    assert.equal(cron.data[0]!.actorId,null);
    const defaultWindow=await list(await request('/admin/audit-logs','admin'));
    assert.equal(defaultWindow.meta.total,0);
  });
  await t.test('writer stores real changes once and rejects private payloads inside caller transaction', async () => {
    const write=() => db.transaction(tx=>writeAudit(tx,{ actorId:ids.users.admin, action:'user.status_changed', entityId:ids.users.customer, before:{status:'active'}, after:{status:'suspended'} }));
    await write();
    await db.transaction(tx=>writeAudit(tx,{ actorId:ids.users.admin, action:'user.status_changed', entityId:ids.users.customer, before:{status:'suspended'}, after:{status:'suspended'} }));
    assert.equal((await pool.query("SELECT count(*)::int n FROM audit_logs WHERE action='user.status_changed'")).rows[0].n,1);
    await assert.rejects(db.transaction(async tx=>{
      await tx.update(venues).set({name:'Must rollback'}).where(eq(venues.id,ids.venues.approvedA));
      await writeAudit(tx,{ actorId:ids.users.admin, action:'venue.status_changed', entityId:ids.venues.approvedA, before:{status:'pending'}, after:JSON.parse('{"status":"approved","token":"must-not-leak"}') });
    }));
    assert.notEqual((await pool.query('SELECT name FROM venues WHERE id=$1',[ids.venues.approvedA])).rows[0].name,'Must rollback');
    await assert.rejects(db.transaction(async tx=>{
      await writeAudit(tx,{actorId:ids.users.admin,action:'review.visibility_changed',entityId:v7(),before:{isVisible:true},after:{isVisible:false}});
      throw new Error('Forced later failure');
    }));
    assert.equal((await pool.query("SELECT count(*)::int n FROM audit_logs WHERE action='review.visibility_changed'")).rows[0].n,0);
  });
  await t.test('Venue uses shared writer; retry has no extra audit, DB audit failure rolls mutation back', async () => {
    const route='/venues/'+ids.venues.pendingA+'/status';
    assert.equal((await request(route,'admin','PATCH',{status:'approved'})).status,200);
    assert.equal((await request(route,'admin','PATCH',{status:'approved'})).status,200);
    assert.equal((await pool.query('SELECT count(*)::int n FROM audit_logs WHERE entity_id=$1',[ids.venues.pendingA])).rows[0].n,1);
    await pool.query("CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced private audit failure'; END $$");
    await pool.query('CREATE TRIGGER force_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_audit()');
    try {
      const response=await request('/venues/'+ids.venues.pendingA+'/status','admin','PATCH',{status:'suspended'});
      assert.equal(response.status,500);
      assert.ok(!JSON.stringify(await response.json()).includes('forced private'));
      assert.equal((await pool.query('SELECT status FROM venues WHERE id=$1',[ids.venues.pendingA])).rows[0].status,'approved');
    } finally { await pool.query('DROP TRIGGER force_audit_failure ON audit_logs'); }
  });
  await t.test('Swagger response/query matches design and exposes no write route', async () => {
    const document=SwaggerModule.createDocument(app,new DocumentBuilder().build());
    const route=document.paths['/api/v1/admin/audit-logs'];
    assert.ok(route?.get); assert.equal(route.post,undefined); assert.equal(route.patch,undefined); assert.equal(route.delete,undefined);
    const specUrl=new URL('../../../../docs/openapi/phase-04.openapi.json',import.meta.url);
    if (existsSync(specUrl)) {
      const spec=JSON.parse(await readFile(specUrl,'utf8'));
      const response=route.get.responses['200'] as {content:Record<string,{schema:unknown}>};
      const expected={...spec.components.schemas.AuditViewList,properties:{data:{type:'array',items:spec.components.schemas.AuditView},meta:spec.components.schemas.Meta}};
      assert.deepEqual(response.content['application/json']?.schema,expected);
      assert.deepEqual((route.get.parameters as Array<{name:string}>).map(p=>p.name).sort(),spec.paths['/admin/audit-logs'].get.parameters.map((p:{name:string})=>p.name).sort());
    }
  });
}
