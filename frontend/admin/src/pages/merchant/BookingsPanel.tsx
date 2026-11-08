import { useEffect, useState } from 'react';

import { PAGE_SIZE } from '../../api/endpoints';
import { errorMessage } from '../../api/errors';
import { useBookingDecision, useMerchantBookings } from '../../api/hooks';
import { populated, type Booking, type BookingAction, type BookingStatus } from '../../api/types';
import { Button, FilterTabs, FormAlert, LoadingRows, Pagination, StateMessage, Tag, TextField } from '../../components/ui';
import { BOOKING_ACTION_LABELS, BOOKING_STATUS_LABELS } from '../../utils/labels';
import { reasonError } from '../../utils/validation';
import { bookingActionsAt, vnDateTime } from '../../utils/vnTime';

type Filter = BookingStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'completed', label: 'Khách đã đến' },
  { value: 'no_show', label: 'Không đến' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'all', label: 'Tất cả' },
];

/** Actions that may carry a reason, which the guest sees in their notification. */
const WITH_REASON: BookingAction[] = ['reject', 'cancel'];

function BookingRow({ booking, placeId, now }: { booking: Booking; placeId: string; now: number }) {
  const decide = useBookingDecision(placeId);
  const [reason, setReason] = useState('');
  const [reasonFieldError, setReasonFieldError] = useState<string | null>(null);
  const guest = populated(booking.user);
  const status = booking.status ?? 'pending';
  const actions = bookingActionsAt(status, booking.startsAt, now);
  const canGiveReason = actions.some((action) => WITH_REASON.includes(action));

  function run(action: BookingAction) {
    if (!booking._id) return;
    let text: string | undefined;
    if (WITH_REASON.includes(action)) {
      const error = reasonError(reason, false);
      setReasonFieldError(error);
      if (error) return;
      text = reason.trim() || undefined;
    }
    decide.mutate({ id: booking._id, action, reason: text });
  }

  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {vnDateTime(booking.startsAt)}
          <Tag tone={status === 'pending' ? 'ink' : status === 'cancelled' || status === 'no_show' ? 'error' : 'muted'}>
            {BOOKING_STATUS_LABELS[status]}
          </Tag>
        </span>
        <span className="row__secondary">
          {guest?.name ?? 'Khách'}
          {guest?.email ? ` (${guest.email})` : ''} · {booking.partySize ?? 1} người
        </span>
        {booking.note ? <p className="row__body">Ghi chú của khách: {booking.note}</p> : null}
        {booking.cancellationReason ? <p className="row__body">Lý do hủy: {booking.cancellationReason}</p> : null}
        {booking.arrivedAt ? <span className="row__meta">Khách đến lúc {vnDateTime(booking.arrivedAt)}</span> : null}
        {canGiveReason ? (
          <TextField
            label="Lý do gửi khách nếu từ chối hoặc hủy (không bắt buộc)"
            value={reason}
            maxLength={500}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonFieldError(null);
            }}
            error={reasonFieldError}
            disabled={decide.isPending}
          />
        ) : null}
        {status === 'confirmed' && !actions.includes('arrived') && actions.includes('cancel') ? (
          <span className="row__meta">Nút Khách đã đến mở từ 15 phút trước giờ đặt.</span>
        ) : null}
        <FormAlert message={decide.isError ? errorMessage(decide.error) : null} />
      </div>
      <div className="row__actions">
        {actions.map((action) => (
          <Button
            key={action}
            size="small"
            variant={action === 'approve' || action === 'arrived' ? 'primary' : action === 'reject' || action === 'cancel' ? 'danger' : 'secondary'}
            busy={decide.isPending && decide.variables?.action === action}
            disabled={decide.isPending}
            onClick={() => run(action)}>
            {BOOKING_ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
    </li>
  );
}

/** `GET /api/merchant/places/{id}/bookings` with the owner's decisions. */
export function BookingsPanel({ placeId, manual }: { placeId: string; manual: boolean }) {
  const [filter, setFilter] = useState<Filter>(manual ? 'pending' : 'confirmed');
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  const bookings = useMerchantBookings(placeId, filter, page);
  const items = bookings.data?.items ?? [];

  // Arrival and no-show buttons depend on the clock.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div className="section">
        <FilterTabs
          label="Lọc booking"
          value={filter}
          options={FILTERS}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        />
        <p className="field__hint">
          Yêu cầu chờ duyệt tự hủy khi còn dưới 1 giờ. Lượt đã xác nhận tự thành Không đến sau giờ đặt 15 phút nếu chưa bấm Khách đã đến.
        </p>
      </div>
      {bookings.isPending ? (
        <LoadingRows rows={3} />
      ) : bookings.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được booking"
          sentence={errorMessage(bookings.error)}
          action={{ label: 'Thử lại', onClick: () => void bookings.refetch(), busy: bookings.isFetching }}
        />
      ) : items.length === 0 ? (
        <StateMessage heading="Không có booking" sentence="Booking của khách ở trạng thái này sẽ hiện ở đây." />
      ) : (
        <ul className="rows">
          {items.map((booking) => (
            <BookingRow key={booking._id} booking={booking} placeId={placeId} now={now} />
          ))}
        </ul>
      )}
      <Pagination page={page} limit={bookings.data?.limit ?? PAGE_SIZE} total={bookings.data?.total ?? 0} onChange={setPage} />
    </>
  );
}
