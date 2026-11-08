import type { AppNotification, User } from '../api/types';
import { hasPermission } from './permissions';

/** The page that handles a notification's resource for this account, if any. */
export function notificationLink(item: Pick<AppNotification, 'resourceType'>, user: User | null): string | null {
  if (user?.role === 'admin') {
    switch (item.resourceType) {
      case 'MerchantClaim':
        return hasPermission(user, 'places') ? '/claims' : null;
      case 'PlaceChangeRequest':
        return hasPermission(user, 'places') ? '/place-changes' : null;
      case 'Place':
        return hasPermission(user, 'places') ? '/places?approval=pending' : null;
      case 'FraudFlag':
        return hasPermission(user, 'fraud') ? '/fraud' : null;
      default:
        return null;
    }
  }
  switch (item.resourceType) {
    case 'MerchantClaim':
    case 'Place':
      return '/merchant';
    case 'PlaceChangeRequest':
      return '/merchant/requests';
    default:
      return null;
  }
}
