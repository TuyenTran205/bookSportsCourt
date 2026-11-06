import type { PoolClient } from 'pg';
import type { BookingStatus, PaymentStatus } from '../../../../packages/shared/src/constants.js';
import { assertVenueTestSchema, seedVenueFixtures, venueFixtureIds as venue } from './venues.fixture.js';

const id = (n: number) => `019a0000-0004-7000-8000-${String(n).padStart(12, '0')}`;
export const phase4FixtureIds = {
  users: { ...venue.users, customerA: venue.users.customer, customerB: id(1), adminA: venue.users.admin, adminB: id(2) },
  venues: { a: venue.venues.approvedA, b: venue.venues.approvedB },
  courts: { a: id(10), b: id(11) },
  applications: { pending: id(20), rejected: id(21), approved: id(22) },
  bookings: { pending: id(30), submitted: id(31), completed: id(32), rejected: id(33), refunded: id(34), cancelled: id(35), expired: id(36), cash: id(37), legacy: id(38), completedB: id(39), reviewTwo: id(40), reviewThree: id(41), reviewHidden: id(42) },
  payments: { pending: id(50), submitted: id(51), completed: id(52), rejected: id(53), refunded: id(54), cancelled: id(55), expired: id(56), cash: id(57), legacy: id(58), completedB: id(59) },
  reviews: { visible: id(60), hidden: id(61) },
  oauthAccount: id(70),
} as const;

/** Recreate in a fresh isolated schema. Never seeds public or bypasses constraints. */
export async function seedPhase4Fixtures(client: PoolClient, passwordHash: string) {
  await assertVenueTestSchema(client);
  await seedVenueFixtures(client, passwordHash);
  const f = phase4FixtureIds;
  for (const [userId, role] of [[f.users.customerB, 'customer'], [f.users.adminB, 'admin']]) {
    await client.query('INSERT INTO users(id,email,password_hash,full_name,role,email_verified_at) VALUES($1,$2,$3,$4,$5,now())', [userId, `${role}-b@phase4.example.test`, passwordHash, `Phase4 ${role} B`, role]);
  }
  for (const [key, status, userId] of [
    ['pending', 'pending', f.users.customerA], ['rejected', 'rejected', f.users.customerB], ['approved', 'approved', f.users.ownerB],
  ] as const) {
    await client.query(`INSERT INTO owner_applications(id,user_id,business_name,phone,address,tax_code,status,review_note,reviewed_by,reviewed_at)
      VALUES($1,$2,'Fixture business','0912345678','123 Test Street','0123456789',$3,$4,$5,$6)`,
    [f.applications[key], userId, status, status === 'pending' ? null : 'Fixture decision', status === 'pending' ? null : f.users.adminA, status === 'pending' ? null : '2035-01-01T00:00:00Z']);
  }
  for (const key of ['a', 'b'] as const) {
    await client.query('INSERT INTO courts(id,venue_id,name,sport_id) VALUES($1,$2,$3,$4)', [f.courts[key], f.venues[key], `Court ${key}`, venue.sports.badminton]);
    await client.query(`INSERT INTO opening_hours(id,court_id,day_of_week,open_time,close_time) VALUES($1,$2,1,'06:00','23:00')`, [id(key === 'a' ? 80 : 81), f.courts[key]]);
    await client.query(`INSERT INTO pricing_rules(id,court_id,name,price_per_slot,start_time,end_time) VALUES($1,$2,'Fixture price',50000,'06:00','23:00')`, [id(key === 'a' ? 82 : 83), f.courts[key]]);
    await client.query(`INSERT INTO venue_payment_accounts(venue_id,bank_bin,account_no,account_name) VALUES($1,'970436','1234567890','FIXTURE OWNER')`, [f.venues[key]]);
  }
  const states: Array<[Exclude<keyof typeof f.payments, 'completedB'>, BookingStatus, PaymentStatus]> = [
    ['pending', 'held', 'pending'], ['submitted', 'pending_payment', 'submitted'], ['completed', 'completed', 'completed'],
    ['rejected', 'cancelled', 'rejected'], ['refunded', 'cancelled', 'refunded'], ['cancelled', 'cancelled', 'cancelled'],
    ['expired', 'expired', 'expired'], ['cash', 'completed', 'completed'], ['legacy', 'completed', 'completed'],
  ];
  const snapshot = { bankBin: '970436', accountNo: '1234567890', accountName: 'FIXTURE OWNER' };
  for (const [index, [key, bookingStatus, paymentStatus]] of states.entries()) {
    const start = `2035-01-${String(index + 1).padStart(2, '0')}T01:00:00Z`;
    const end = start.replace('01:00:00', '02:00:00');
    await client.query(`INSERT INTO bookings(id,court_id,customer_id,guest_name,source,during,status,total_price,deposit_amount,expires_at)
      VALUES($1,$2,$3,$4,$5,tstzrange($6::timestamptz,$7::timestamptz,'[)'),$8,100000,50000,$9)`,
    [f.bookings[key], f.courts.a, key === 'cash' ? null : f.users.customerA, key === 'cash' ? 'Manual guest' : null, key === 'cash' ? 'manual' : 'online', start, end, bookingStatus, bookingStatus === 'held' ? '2035-01-01T00:10:00Z' : null]);
    const proof = ['submitted', 'completed', 'rejected', 'refunded', 'cancelled'].includes(key);
    await client.query(`INSERT INTO payments(id,booking_id,amount,provider,transfer_code,status,bank_account_snapshot,proof_object_key,proof_uploaded_at,proof_updated_at,paid_at,refund_amount,refunded_at,reject_reason)
      VALUES($1,$2,50000,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12)`,
    [f.payments[key], f.bookings[key], key === 'cash' ? 'cash' : 'bank_transfer', key === 'cash' ? null : `P4-${key}`, paymentStatus,
      ['cash', 'legacy'].includes(key) ? null : snapshot, proof ? `private/fixture/${key}.png` : null, proof ? '2035-01-01T00:00:00Z' : null,
      ['completed', 'refunded', 'cash'].includes(key) ? '2035-01-01T00:30:00Z' : null, key === 'refunded' ? 25000 : null, key === 'refunded' ? '2035-02-01T00:00:00Z' : null, key === 'rejected' ? 'Invalid proof' : null]);
    if (['completed', 'rejected', 'refunded'].includes(key)) {
      await client.query("UPDATE payments SET reviewed_by=$1,reviewed_at='2035-01-01T00:30:00Z' WHERE id=$2", [f.users.ownerA, f.payments[key]]);
    }
    if (bookingStatus === 'cancelled') {
      await client.query("UPDATE bookings SET cancel_reason=$1,cancelled_by=$2,cancelled_at='2035-01-01T00:30:00Z' WHERE id=$3", [key === 'rejected' ? 'Invalid proof' : key === 'cancelled' ? 'OWNER_REVIEW_TIMEOUT' : 'Customer cancellation', key === 'cancelled' ? null : key === 'rejected' ? f.users.ownerA : f.users.customerA, f.bookings[key]]);
    }
  }
  for (const [index, key] of (['completedB', 'reviewTwo', 'reviewThree', 'reviewHidden'] as const).entries()) {
    await client.query(`INSERT INTO bookings(id,court_id,customer_id,during,status,total_price,deposit_amount)
      VALUES($1,$2,$3,tstzrange($4::timestamptz,$5::timestamptz,'[)'),'completed',100000,50000)`,
    [f.bookings[key], key === 'completedB' ? f.courts.b : f.courts.a, key === 'completedB' ? f.users.customerB : f.users.customerA,
      `2035-02-0${index + 1}T01:00:00Z`, `2035-02-0${index + 1}T02:00:00Z`]);
  }
  for (const [reviewId, bookingId, rating, visible] of [
    [f.reviews.visible, f.bookings.completed, 5, true], [id(62), f.bookings.reviewTwo, 4, true],
    [id(63), f.bookings.reviewThree, 4, true], [f.reviews.hidden, f.bookings.reviewHidden, 1, false],
  ] as const) {
    await client.query('INSERT INTO reviews(id,booking_id,venue_id,customer_id,rating,is_visible) VALUES($1,$2,$3,$4,$5,$6)', [reviewId, bookingId, f.venues.a, f.users.customerA, rating, visible]);
  }
  await client.query(`INSERT INTO payments(id,booking_id,amount,transfer_code,status,bank_account_snapshot,paid_at,proof_object_key,proof_uploaded_at,proof_updated_at,reviewed_by,reviewed_at)
    VALUES($1,$2,50000,'P4-completed-B','completed',$3,'2035-02-01T00:30:00Z','private/fixture/completed-b.png','2035-02-01T00:00:00Z','2035-02-01T00:00:00Z',$4,'2035-02-01T00:30:00Z')`, [f.payments.completedB, f.bookings.completedB, snapshot, f.users.ownerB]);
  await client.query(`INSERT INTO oauth_accounts(id,user_id,provider,provider_id) VALUES($1,$2,'google','fixture-google-subject')`, [f.oauthAccount, f.users.customerB]);
  return f;
}
