import { useState } from 'react';
import { Link } from 'react-router';

import { errorMessage } from '../api/errors';
import { useAnalytics } from '../api/hooks';
import type { Analytics } from '../api/types';
import { LoadingRows, PageHeader, StateMessage } from '../components/ui';

type Stat = { key: Exclude<keyof Analytics, 'period'>; label: string; link?: { to: string; label: string }; alert?: boolean };

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
  { key: 'pendingEmails', label: 'Email đang chờ gửi' },
  { key: 'failedEmails', label: 'Email gửi thất bại', alert: true },
];

export function OverviewPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const analytics = useAnalytics(from || undefined, to || undefined);

  return (
    <>
      <PageHeader title="Tổng quan" />
      <div className="section ops-filter">
        <label className="field">Từ ngày<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="field">Đến ngày<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <p className="section field__hint">Số liệu tổng quan bên dưới là số hiện tại. Khoảng ngày áp dụng cho hoạt động trong kỳ.</p>
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
        <>
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
        <div className="section">
          <h2>Hoạt động {analytics.data.period?.from} – {analytics.data.period?.to}</h2>
          <div className="stats">
            {([
              ['newUsers', 'Tài khoản mới'], ['newPlaces', 'Địa điểm mới'], ['newBookings', 'Booking mới'],
              ['completedBookings', 'Booking đã đến'], ['cancelledBookings', 'Booking đã hủy'], ['noShows', 'Không đến'],
              ['newCheckins', 'Check-in mới'], ['newReviews', 'Đánh giá mới'], ['newReports', 'Báo cáo mới'],
              ['newVerifiedVisits', 'Lượt ghé đã xác minh'],
            ] as const).map(([key, label]) => (
              <div key={key} className="stat"><span className="stat__label">{label}</span><strong className="stat__value">{analytics.data.period?.[key] ?? 0}</strong></div>
            ))}
          </div>
          <p className="field__hint">Trạng thái booking tính theo tình trạng hiện tại của những booking tạo trong kỳ.</p>
        </div>
        </>
      )}
    </>
  );
}
