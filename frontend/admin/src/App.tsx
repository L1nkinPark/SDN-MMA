import { createBrowserRouter, Link, RouterProvider } from 'react-router';

import { Layout } from './components/Layout';
import { StateMessage } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { NewPlacePage } from './pages/NewPlacePage';
import { OverviewPage } from './pages/OverviewPage';
import { PlacesPage } from './pages/PlacesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReviewsPage } from './pages/ReviewsPage';

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
      { index: true, element: <OverviewPage /> },
      { path: 'places', element: <PlacesPage /> },
      { path: 'places/new', element: <NewPlacePage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
