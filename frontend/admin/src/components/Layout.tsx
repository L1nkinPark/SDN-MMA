import { NavLink, Navigate, Outlet, useLocation } from 'react-router';

import { useSession } from '../auth/sessionContext';
import { Button, LoadingRows } from './ui';

const LINKS = [
  { to: '/', label: 'Tổng quan', end: true },
  { to: '/places', label: 'Địa điểm', end: false },
  { to: '/reports', label: 'Báo cáo', end: false },
  { to: '/reviews', label: 'Đánh giá', end: false },
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
          StudySpot <small>Quản trị</small>
        </NavLink>
        <nav className="nav" aria-label="Điều hướng chính">
          {LINKS.map((link) => (
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
