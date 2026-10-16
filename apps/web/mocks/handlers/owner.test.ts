import { describe, expect, it } from 'vitest';
import { db } from '../db';
import { initialBookings, venueIdByCourtId } from '../fixtures/bookings';
import { allCourts } from '../fixtures/venues';
import { authorizeCustomer } from './owner';

describe('owner application permissions', () => {
  it('allows only authenticated customer accounts to submit applications', () => {
    const customer = db.users.find((user) => user.role === 'customer');
    const owner = db.users.find((user) => user.role === 'owner');
    const admin = db.users.find((user) => user.role === 'admin');
    if (!customer || !owner || !admin) throw new Error('Missing mock users for role tests');

    expect(authorizeCustomer(customer)).toHaveProperty('user', customer);
    expect(authorizeCustomer(null).error?.status).toBe(401);
    expect(authorizeCustomer(owner).error?.status).toBe(403);
    expect(authorizeCustomer(admin).error?.status).toBe(403);
  });
});

describe('owner court fixtures', () => {
  it('keeps court IDs unique and resolvable for seeded bookings', () => {
    const courtIds = allCourts.map((court) => court.id);

    expect(new Set(courtIds).size).toBe(courtIds.length);
    expect(Object.keys(venueIdByCourtId)).toHaveLength(courtIds.length);
    expect(initialBookings.every(({ booking }) => venueIdByCourtId[booking.courtId])).toBe(true);
  });
});
