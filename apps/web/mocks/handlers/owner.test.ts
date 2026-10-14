import { describe, expect, it } from 'vitest';
import { db } from '../db';
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
