import { NavLink, Navigate, Outlet, useLocation } from 'react-router';

import { useSession } from '../auth/sessionContext';
import { Button, LoadingRows } from './ui';

const LINKS = [
  { to: '/', label: 'Tổng quan', end: true, permission: 'analytics' },
  { to: '/places', label: 'Địa điểm', end: false, permission: 'places' },
  { to: '/reports', label: 'Báo cáo', end: false, permission: 'moderation' },
  { to: '/reviews', label: 'Đánh giá', end: false, permission: 'moderation' },
  { to: '/users', label: 'Người dùng', end: false, permission: 'users' },
  { to: '/claims', label: 'Hồ sơ chủ quán', end: false, permission: 'places' },
  { to: '/place-changes', label: 'Thay đổi quán', end: false, permission: 'places' },
  { to: '/bookings', label: 'Đặt chỗ', end: false, permission: 'bookings' },
  { to: '/fraud', label: 'Bất thường', end: false, permission: 'fraud' },
  { to: '/audit', label: 'Nhật ký', end: false, permission: 'audit' },
];

/** Signed-in frame: brand, section links and the admin's name. Sends everyone else to /login. */
export function Layout() {
  const { status, user, signOut } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="shell">
        <LoadingRows rows={3} />
      </div>
    );
  }
  if (status !== 'signed-in') {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} replace />;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="topbar__brand">
          StudySpot <small>{user?.role === 'admin' ? 'Quản trị' : 'Chủ quán'}</small>
        </NavLink>
        <nav className="nav" aria-label="Điều hướng chính">
          {(user?.role !== 'admin' ? [{ to: '/merchant', label: 'Quán của tôi', end: true }] : LINKS.filter((link) =>
            !('permission' in link) || !link.permission || user?.adminPermissions?.includes('*') ||
            user?.adminPermissions?.includes(link.permission as NonNullable<typeof user.adminPermissions>[number]))).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar__user">
          <span>{user?.name ?? user?.email}</span>
          <Button variant="danger-text" size="small" onClick={() => void signOut()}>
            Đăng xuất
          </Button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
