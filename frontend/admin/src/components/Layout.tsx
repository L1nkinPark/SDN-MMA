import { NavLink, Navigate, Outlet, useLocation } from 'react-router';

import { useUnreadNotificationCount } from '../api/hooks';
import { useSession } from '../auth/sessionContext';
import { linksFor } from './navigation';
import { Button, LoadingRows } from './ui';

/** Signed-in frame: brand, the sections this account may open, notifications and account. Sends guests to /login. */
export function Layout() {
  const { status, user, signOut } = useSession();
  const location = useLocation();
  const unread = useUnreadNotificationCount(status === 'signed-in');

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

  const count = unread.data ?? 0;
  const area = user?.role === 'admin' ? 'Quản trị' : user?.role === 'merchant' ? 'Chủ quán' : 'Hồ sơ chủ quán';

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="topbar__brand">
          StudySpot <small>{area}</small>
        </NavLink>
        <nav className="nav" aria-label="Điều hướng chính">
          {linksFor(user).map((link) => (
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
          <NavLink
            to="/notifications"
            className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}
            aria-label={count ? `Thông báo, ${count} chưa đọc` : 'Thông báo'}>
            Thông báo
            {count ? <span className="count">{count > 99 ? '99+' : count}</span> : null}
          </NavLink>
          <NavLink to="/account" className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}>
            {user?.name ?? user?.email ?? 'Tài khoản'}
          </NavLink>
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
