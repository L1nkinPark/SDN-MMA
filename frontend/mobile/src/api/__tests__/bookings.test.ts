import { bookingPlace, bookingStatusLabel, isActiveBooking } from '../bookings';
import { notificationTarget } from '../notifications';

describe('bookings', () => {
  it('labels every status in Vietnamese', () => {
    expect(bookingStatusLabel('pending')).toBe('Chờ quán xác nhận');
    expect(bookingStatusLabel('no_show')).toBe('Không đến');
  });

  it('treats only pending and confirmed as holding a seat', () => {
    expect(isActiveBooking({ status: 'pending' })).toBe(true);
    expect(isActiveBooking({ status: 'confirmed' })).toBe(true);
    expect(isActiveBooking({ status: 'completed' })).toBe(false);
    expect(isActiveBooking({ status: 'cancelled' })).toBe(false);
  });

  it('reads the populated place and tolerates a removed one', () => {
    expect(bookingPlace({ place: { _id: 'p1', name: 'Quán A' } })?.name).toBe('Quán A');
    expect(bookingPlace({ place: 'p1' })).toBeNull();
    expect(bookingPlace({ place: null })).toBeNull();
  });
});

describe('notification target', () => {
  it('opens the screen that matches the resource', () => {
    expect(notificationTarget({ resourceType: 'Booking', resourceId: 'b1' })).toEqual({ pathname: '/my-bookings' });
    expect(notificationTarget({ resourceType: 'Report', resourceId: 'r1' })).toEqual({ pathname: '/my-reports' });
    expect(notificationTarget({ resourceType: 'Place', resourceId: 'p1' })).toEqual({
      pathname: '/places/[id]',
      params: { id: 'p1' },
    });
  });

  it('stays on the list for resources the app has no screen for', () => {
    expect(notificationTarget({ resourceType: 'MerchantClaim', resourceId: 'c1' })).toBeNull();
    expect(notificationTarget({ resourceType: null, resourceId: null })).toBeNull();
  });
});
