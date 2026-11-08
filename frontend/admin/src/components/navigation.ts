import type { AdminPermission, User } from '../api/types';
import { hasPermission } from '../utils/permissions';

export type NavLinkSpec = { to: string; label: string; end: boolean; permission?: AdminPermission };

/** Admin sections, each gated by the backend permission its endpoints require. */
export const ADMIN_LINKS: NavLinkSpec[] = [
  { to: '/', label: 'Tổng quan', end: true, permission: 'analytics' },
  { to: '/places', label: 'Địa điểm', end: false, permission: 'places' },
  { to: '/claims', label: 'Hồ sơ chủ quán', end: false, permission: 'places' },
  { to: '/place-changes', label: 'Thay đổi quán', end: false, permission: 'places' },
  { to: '/reports', label: 'Báo cáo', end: false, permission: 'moderation' },
  { to: '/reviews', label: 'Đánh giá', end: false, permission: 'moderation' },
  { to: '/bookings', label: 'Đặt chỗ', end: false, permission: 'bookings' },
  { to: '/users', label: 'Người dùng', end: false, permission: 'users' },
  { to: '/fraud', label: 'Bất thường', end: false, permission: 'fraud' },
  { to: '/audit', label: 'Nhật ký', end: false, permission: 'audit' },
];

/** Merchant area, also used by students who are applying. */
export const MERCHANT_LINKS: NavLinkSpec[] = [
  { to: '/merchant', label: 'Quán của tôi', end: false },
  { to: '/merchant/new', label: 'Đăng ký quán', end: true },
  { to: '/merchant/claim', label: 'Nhận quyền quán', end: true },
  { to: '/merchant/requests', label: 'Đề nghị đã gửi', end: true },
];

export function linksFor(user: User | null): NavLinkSpec[] {
  if (user?.role !== 'admin') return MERCHANT_LINKS;
  return ADMIN_LINKS.filter((link) => !link.permission || hasPermission(user, link.permission));
}

/** Where an account lands after sign-in: the first admin section it may open, or the merchant area. */
export function homePath(user: User | null): string | null {
  if (user?.role !== 'admin') return '/merchant';
  return linksFor(user)[0]?.to ?? null;
}
