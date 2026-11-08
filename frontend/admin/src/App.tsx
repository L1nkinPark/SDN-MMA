import type { ReactNode } from 'react';
import { createBrowserRouter, Link, Navigate, RouterProvider } from 'react-router';

import type { AdminPermission } from './api/types';
import { useSession } from './auth/sessionContext';
import { Layout } from './components/Layout';
import { homePath } from './components/navigation';
import { StateMessage } from './components/ui';
import { AccountPage } from './pages/AccountPage';
import { AdminBookingsPage } from './pages/AdminBookingsPage';
import { AuditPage } from './pages/AuditPage';
import { ClaimsPage } from './pages/ClaimsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { FraudPage } from './pages/FraudPage';
import { LoginPage } from './pages/LoginPage';
import { ClaimPlacePage } from './pages/merchant/ClaimPlacePage';
import { MerchantHomePage } from './pages/merchant/MerchantHomePage';
import { MerchantNewPlacePage } from './pages/merchant/MerchantNewPlacePage';
import { MerchantPlacePage } from './pages/merchant/MerchantPlacePage';
import { MyRequestsPage } from './pages/merchant/MyRequestsPage';
import { NewPlacePage } from './pages/NewPlacePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OverviewPage } from './pages/OverviewPage';
import { PlaceChangesPage } from './pages/PlaceChangesPage';
import { PlacesPage } from './pages/PlacesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { UsersPage } from './pages/UsersPage';
import { hasPermission } from './utils/permissions';

/** `/` shows Tổng quan to admins who may see it, otherwise sends each account to its own first section. */
function Home() {
  const { user } = useSession();
  if (user?.role === 'admin' && hasPermission(user, 'analytics')) return <OverviewPage />;
  const path = homePath(user);
  if (path && path !== '/') return <Navigate to={path} replace />;
  return (
    <StateMessage
      heading="Chưa được cấp quyền"
      sentence="Tài khoản quản trị này chưa có quyền nào. Hãy nhờ super admin cấp quyền."
    />
  );
}

/** Admin pages need the admin role and the permission their endpoints check. */
function AdminRoute({ permission, children }: { permission: AdminPermission; children: ReactNode }) {
  const { user } = useSession();
  if (user?.role !== 'admin') return <Navigate to="/merchant" replace />;
  if (!hasPermission(user, permission)) {
    return (
      <StateMessage
        heading="Chưa được cấp quyền"
        sentence="Tài khoản của bạn chưa có quyền mở mục này. Hãy nhờ super admin cấp quyền."
      />
    );
  }
  return children;
}

/** Merchant pages are for every account that is not an admin; students use them to apply. */
function MerchantRoute({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return user?.role === 'admin' ? <Navigate to="/" replace /> : children;
}

function NotFound() {
  return (
    <>
      <StateMessage heading="Không tìm thấy trang" sentence="Đường dẫn này không có trong trang quản lý." />
      <p className="section">
        <Link to="/">Về trang đầu</Link>
      </p>
    </>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'account', element: <AccountPage /> },

      { path: 'merchant', element: <MerchantRoute><MerchantHomePage /></MerchantRoute> },
      { path: 'merchant/new', element: <MerchantRoute><MerchantNewPlacePage /></MerchantRoute> },
      { path: 'merchant/claim', element: <MerchantRoute><ClaimPlacePage /></MerchantRoute> },
      { path: 'merchant/requests', element: <MerchantRoute><MyRequestsPage /></MerchantRoute> },
      { path: 'merchant/places/:id', element: <MerchantRoute><MerchantPlacePage /></MerchantRoute> },

      { path: 'places', element: <AdminRoute permission="places"><PlacesPage /></AdminRoute> },
      { path: 'places/new', element: <AdminRoute permission="places"><NewPlacePage /></AdminRoute> },
      { path: 'reports', element: <AdminRoute permission="moderation"><ReportsPage /></AdminRoute> },
      { path: 'reviews', element: <AdminRoute permission="moderation"><ReviewsPage /></AdminRoute> },
      { path: 'users', element: <AdminRoute permission="users"><UsersPage /></AdminRoute> },
      { path: 'claims', element: <AdminRoute permission="places"><ClaimsPage /></AdminRoute> },
      { path: 'place-changes', element: <AdminRoute permission="places"><PlaceChangesPage /></AdminRoute> },
      { path: 'bookings', element: <AdminRoute permission="bookings"><AdminBookingsPage /></AdminRoute> },
      { path: 'fraud', element: <AdminRoute permission="fraud"><FraudPage /></AdminRoute> },
      { path: 'audit', element: <AdminRoute permission="audit"><AuditPage /></AdminRoute> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
