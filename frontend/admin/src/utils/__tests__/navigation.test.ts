import { describe, expect, it } from 'vitest';

import { homePath, linksFor } from '../../components/navigation';
import { notificationLink } from '../notificationLink';

describe('role navigation', () => {
  it('sends students and merchants to the merchant area', () => {
    expect(homePath({ role: 'student' })).toBe('/merchant');
    expect(linksFor({ role: 'student' }).map((link) => link.to)).toEqual(['/merchant', '/merchant/apply']);
    expect(homePath({ role: 'merchant' })).toBe('/merchant');
    expect(linksFor({ role: 'merchant' }).map((link) => link.to)).toContain('/merchant/claim');
  });

  it('shows admins only the sections their permissions open', () => {
    const limited = { role: 'admin' as const, adminPermissions: ['places' as const] };
    expect(linksFor(limited).map((link) => link.to)).toEqual(['/places', '/claims', '/place-changes']);
    expect(homePath(limited)).toBe('/places');
    expect(homePath({ role: 'admin', adminPermissions: ['*'] })).toBe('/');
  });
});

describe('notification links', () => {
  it('opens the page that handles the resource for this role', () => {
    expect(notificationLink({ resourceType: 'MerchantClaim' }, { role: 'admin', adminPermissions: ['*'] })).toBe('/claims');
    expect(notificationLink({ resourceType: 'FraudFlag' }, { role: 'admin', adminPermissions: ['places'] })).toBeNull();
    expect(notificationLink({ resourceType: 'PlaceChangeRequest' }, { role: 'merchant' })).toBe('/merchant/requests');
    expect(notificationLink({ resourceType: 'Booking' }, { role: 'merchant' })).toBeNull();
  });
});
