import { useEffect, useState } from 'react';

import { PAGE_SIZE } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { useAdminBookings, useAdminCancelBooking } from '../api/hooks';
import { populated, type Booking, type BookingStatus } from '../api/types';
import { Button, FilterTabs, FormAlert, LoadingRows, PageHeader, Pagination, StateMessage, Tag, TextField } from '../components/ui';
import { BOOKING_STATUS_LABELS } from '../utils/labels';
import { reasonError } from '../utils/validation';
import { vnDateTime } from '../utils/vnTime';

type Filter = BookingStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ quán xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'completed', label: 'Khách đã đến' },
  { value: 'no_show', label: 'Không đến' },
  { value: 'cancelled', label: 'Đã hủy' },
];

function BookingRow({ booking, now }: { booking: Booking; now: number }) {
  const cancel = useAdminCancelBooking();
  const [reason, setReason] = useState('');
  const [reasonFieldError, setReasonFieldError] = useState<string | null>(null);
  const place = populated(booking.place);
  const guest = populated(booking.user);
  const status = booking.status ?? 'pending';
  const cancellable = (status === 'pending' || status === 'confirmed') && Date.parse(booking.startsAt ?? '') > now;

  function submit() {
    const error = reasonError(reason, true);
    setReasonFieldError(error);
    if (error || !booking._id) return;
    cancel.mutate({ id: booking._id, reason: reason.trim() });
  }

  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {place?.name ?? 'Địa điểm'}
          <Tag tone={status === 'pending' || status === 'confirmed' ? 'ink' : status === 'completed' ? 'muted' : 'error'}>
            {BOOKING_STATUS_LABELS[status]}
          </Tag>
        </span>
        <span className="row__secondary">
          {vnDateTime(booking.startsAt)} · {booking.partySize ?? 1} người · {guest?.name ?? 'Khách'}
          {guest?.email ? ` (${guest.email})` : ''}
        </span>
        {booking.note ? <p className="row__body">Ghi chú: {booking.note}</p> : null}
        {booking.cancellationReason ? <p className="row__body">Lý do hủy: {booking.cancellationReason}</p> : null}
        {cancellable ? (
          <TextField
            label="Lý do hủy gửi khách (bắt buộc, ít nhất 5 ký tự)"
            value={reason}
            maxLength={500}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonFieldError(null);
            }}
            error={reasonFieldError}
            disabled={cancel.isPending}
          />
        ) : null}
        <FormAlert message={cancel.isError ? errorMessage(cancel.error) : null} />
      </div>
      <div className="row__actions">
        {cancellable ? (
          <Button size="small" variant="danger" busy={cancel.isPending} onClick={submit}>
            Hủy booking
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** `GET /api/admin/bookings`: every booking, with cancellation of active future ones. */
export function AdminBookingsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const bookings = useAdminBookings(filter, page);
  const items = bookings.data?.items ?? [];
  const [now, setNow] = useState(() => Date.now());

  // Only future bookings can be cancelled; keep that check current while the page stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <PageHeader title="Đặt chỗ" right={bookings.data ? <span>{bookings.data.total} booking</span> : null} />
      <FilterTabs
        label="Lọc booking"
        value={filter}
        options={FILTERS}
        onChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
      />
      <p className="section field__hint">Hủy một booking sẽ trả chỗ cho quán, gửi lý do cho khách và ghi vào nhật ký.</p>
      {bookings.isPending ? (
        <LoadingRows />
      ) : bookings.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được booking"
          sentence={errorMessage(bookings.error)}
          action={{ label: 'Thử lại', onClick: () => void bookings.refetch(), busy: bookings.isFetching }}
        />
      ) : items.length === 0 ? (
        <StateMessage heading="Không có booking" sentence="Booking ở trạng thái này sẽ hiện ở đây." />
      ) : (
        <ul className="rows">
          {items.map((booking) => (
            <BookingRow key={booking._id} booking={booking} now={now} />
          ))}
        </ul>
      )}
      <Pagination page={page} limit={bookings.data?.limit ?? PAGE_SIZE} total={bookings.data?.total ?? 0} onChange={setPage} />
    </>
  );
}
