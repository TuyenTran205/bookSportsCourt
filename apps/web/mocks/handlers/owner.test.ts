import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { initialBookings, venueIdByCourtId } from '../fixtures/bookings';
import { allCourts } from '../fixtures/venues';
import {
  authorizeCustomer,
  hasOverlappingPricingRule,
  isValidOpeningHours,
  ownedVenueForCourt,
} from './owner';

const originalCurrentUserId = db.currentUserId;

afterEach(() => {
  db.currentUserId = originalCurrentUserId;
});

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

  it('does not resolve a foreign court as manageable by the current owner', () => {
    const owner = db.users.find((user) => user.role === 'owner');
    if (!owner) throw new Error('Missing mock owner for permission test');
    const foreignVenue = db.venues.find(
      (venue) => venue.ownerId !== owner.id && venue.courts.length > 0,
    );
    const foreignCourt = foreignVenue?.courts[0];
    if (!foreignVenue || !foreignCourt) throw new Error('Missing foreign court for permission test');

    db.currentUserId = owner.id;
    expect(ownedVenueForCourt(foreignCourt.id)).toBeUndefined();
    expect(db.venues.find((venue) => venue.id === foreignVenue.id)?.courts).toContainEqual(
      foreignCourt,
    );
  });
});

describe('owner pricing validation', () => {
  it('requires exactly one valid opening-hours entry for each weekday', () => {
    const hours = [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
      weekday,
      openTime: '06:00',
      closeTime: '22:00',
      isClosed: false,
    }));

    expect(isValidOpeningHours(hours)).toBe(true);
    expect(isValidOpeningHours(hours.slice(1))).toBe(false);
    expect(isValidOpeningHours(hours.map((hour, index) =>
      index === 1 ? { ...hour, weekday: 1 } : hour,
    ))).toBe(false);
    expect(isValidOpeningHours(hours.map((hour, index) =>
      index === 0 ? { ...hour, closeTime: '05:00' } : hour,
    ))).toBe(false);
    expect(isValidOpeningHours(hours.map((hour, index) =>
      index === 0 ? { ...hour, openTime: '99:00' } : hour,
    ))).toBe(false);
  });

  it('detects overlapping rules only within the same venue, court, and weekday', () => {
    const existing = [{
      id: 'rule-1',
      venueId: 'venue-1',
      courtId: null,
      label: 'Giờ thường',
      weekdays: [1, 2],
      startTime: '06:00',
      endTime: '17:00',
      pricePerSlot: 80000,
    }];

    expect(hasOverlappingPricingRule(existing, {
      venueId: 'venue-1',
      courtId: null,
      weekdays: [1],
      startTime: '16:30',
      endTime: '18:00',
    })).toBe(true);
    expect(hasOverlappingPricingRule(existing, {
      venueId: 'venue-1',
      courtId: null,
      weekdays: [1],
      startTime: '17:00',
      endTime: '18:00',
    })).toBe(false);
    expect(hasOverlappingPricingRule(existing, {
      venueId: 'venue-1',
      courtId: 'court-1',
      weekdays: [1],
      startTime: '16:30',
      endTime: '18:00',
    })).toBe(false);
    expect(hasOverlappingPricingRule(existing, {
      venueId: 'venue-2',
      courtId: null,
      weekdays: [1],
      startTime: '16:30',
      endTime: '18:00',
    })).toBe(false);
  });
});
