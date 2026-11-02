import { createBrowserRouter, Link, Navigate, RouterProvider } from 'react-router';

import { Layout } from './components/Layout';
import { StateMessage } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { NewPlacePage } from './pages/NewPlacePage';
import { OverviewPage } from './pages/OverviewPage';
import { PlacesPage } from './pages/PlacesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { OperationsPage } from './pages/OperationsPage';
import { MerchantPage } from './pages/MerchantPage';
import { useSession } from './auth/sessionContext';

function RoleHome() {
  const { user } = useSession();
  if (user?.role !== 'admin') return <Navigate to="/merchant" replace />;
  if (user.adminPermissions?.includes('*') || user.adminPermissions?.includes('analytics')) return <OverviewPage />;
  const first = ([['places', '/places'], ['users', '/users'], ['moderation', '/reports'], ['bookings', '/bookings'],
    ['fraud', '/fraud'], ['audit', '/audit']] as const).find(([permission]) => user.adminPermissions?.includes(permission));
  return first ? <Navigate to={first[1]} replace /> : <p className="section">Tài khoản chưa được cấp quyền quản trị.</p>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  return user?.role === 'admin' ? children : <Navigate to="/merchant" replace />;
}

function MerchantOnly() {
  const { user } = useSession();
  return user?.role !== 'admin' ? <MerchantPage /> : <Navigate to="/" replace />;
}

function NotFound() {
  return (
    <>
      <StateMessage heading="Không tìm thấy trang" sentence="Đường dẫn này không có trong trang quản trị." />
      <p className="section">
        <Link to="/">Về Tổng quan</Link>
      </p>
    </>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <RoleHome /> },
      { path: 'merchant', element: <MerchantOnly /> },
      { path: 'places', element: <AdminOnly><PlacesPage /></AdminOnly> },
      { path: 'places/new', element: <AdminOnly><NewPlacePage /></AdminOnly> },
      { path: 'reports', element: <AdminOnly><ReportsPage /></AdminOnly> },
      { path: 'reviews', element: <AdminOnly><ReviewsPage /></AdminOnly> },
      { path: 'users', element: <AdminOnly><OperationsPage kind="users" /></AdminOnly> },
      { path: 'claims', element: <AdminOnly><OperationsPage kind="claims" /></AdminOnly> },
      { path: 'place-changes', element: <AdminOnly><OperationsPage kind="place-changes" /></AdminOnly> },
      { path: 'bookings', element: <AdminOnly><OperationsPage kind="bookings" /></AdminOnly> },
      { path: 'fraud', element: <AdminOnly><OperationsPage kind="fraud" /></AdminOnly> },
      { path: 'audit', element: <AdminOnly><OperationsPage kind="audit" /></AdminOnly> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
