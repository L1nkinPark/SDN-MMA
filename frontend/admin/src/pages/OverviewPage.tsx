import { Link } from 'react-router';

import { errorMessage } from '../api/errors';
import { useAnalytics } from '../api/hooks';
import type { Analytics } from '../api/types';
import { LoadingRows, PageHeader, StateMessage } from '../components/ui';

type Stat = { key: keyof Analytics; label: string; link?: { to: string; label: string }; alert?: boolean };

const STATS: Stat[] = [
  { key: 'pendingPlaces', label: 'Địa điểm chờ duyệt', link: { to: '/places?approval=pending', label: 'Duyệt ngay' }, alert: true },
  { key: 'pendingReports', label: 'Báo cáo chờ xử lý', link: { to: '/reports?status=pending', label: 'Xử lý ngay' }, alert: true },
  { key: 'reviews', label: 'Đánh giá đang hiện', link: { to: '/reviews', label: 'Xem đánh giá' } },
  { key: 'approvedPlaces', label: 'Địa điểm đã duyệt', link: { to: '/places?approval=approved', label: 'Xem địa điểm' } },
  { key: 'users', label: 'Tài khoản' },
  { key: 'activeCheckins', label: 'Check-in còn hiệu lực' },
  { key: 'pendingClaims', label: 'Chủ quán chờ duyệt', link: { to: '/claims', label: 'Xem hồ sơ' }, alert: true },
  { key: 'upcomingBookings', label: 'Booking sắp tới', link: { to: '/bookings', label: 'Xem booking' } },
  { key: 'pendingFraudFlags', label: 'Cờ gian lận', link: { to: '/fraud', label: 'Rà soát' }, alert: true },
];

export function OverviewPage() {
  const analytics = useAnalytics();

  return (
    <>
      <PageHeader title="Tổng quan" />
      {analytics.isPending ? (
        <LoadingRows rows={3} />
      ) : analytics.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được số liệu"
          sentence={errorMessage(analytics.error)}
          action={{ label: 'Thử lại', onClick: () => void analytics.refetch(), busy: analytics.isFetching }}
        />
      ) : (
        <div className="stats">
          {STATS.map((stat) => {
            const value = analytics.data[stat.key] ?? 0;
            return (
              <div key={stat.key} className="stat">
                <span className="stat__label">{stat.label}</span>
                <strong className={`stat__value${stat.alert && value > 0 ? ' stat__value--alert' : ''}`}>{value}</strong>
                {stat.link ? (
                  <Link className="stat__link" to={stat.link.to}>
                    {stat.link.label}
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
