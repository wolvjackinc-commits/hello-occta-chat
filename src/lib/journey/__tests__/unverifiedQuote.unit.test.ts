import { expect, it } from 'vitest';
import { summariseCheckoutFunnel, isRecentlyActive } from '../checkoutFunnel';
it('excludes unverified thank-you visits from conversions and active sessions', () => {
  const rows = [{ status: 'unverified', last_activity_at: new Date().toISOString() }, { status: 'completed', last_activity_at: new Date().toISOString() }];
  expect(summariseCheckoutFunnel(rows)).toMatchObject({ completed: 1, eligibleStarted: 1, conversionRate: 100, activeRecent: 0, activeStale: 0 });
  expect(isRecentlyActive(rows[0])).toBe(false);
});
