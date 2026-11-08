import { useState } from 'react';
import { useNavigate } from 'react-router';

import { PAGE_SIZE } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsPage } from '../api/hooks';
import type { AppNotification } from '../api/types';
import { useSession } from '../auth/sessionContext';
import { Button, FilterTabs, FormAlert, LoadingRows, PageHeader, Pagination, StateMessage, Tag } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { notificationLink } from '../utils/notificationLink';

function NotificationRow({ item }: { item: AppNotification }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const unread = !item.readAt;
  const link = notificationLink(item, user);
  return (
    <li className={`row${unread ? ' row--unread' : ''}`}>
      <div className="row__main">
        <span className="row__title">
          {item.title}
          {unread ? <Tag tone="ink">Chưa đọc</Tag> : null}
        </span>
        <p className="row__body">{item.body}</p>
        <span className="row__meta">{formatDateTime(item.createdAt)}</span>
        <FormAlert message={markRead.isError ? errorMessage(markRead.error) : null} />
      </div>
      <div className="row__actions">
        {link ? (
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              if (unread) markRead.mutate(item._id);
              navigate(link);
            }}>
            Mở
          </Button>
        ) : null}
        {unread ? (
          <Button size="small" variant="text" busy={markRead.isPending} onClick={() => markRead.mutate(item._id)}>
            Đánh dấu đã đọc
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** `GET /api/notifications` for admins and merchants: new claims, bookings, decisions... */
export function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const list = useNotificationsPage(filter === 'unread', page);
  const markAll = useMarkAllNotificationsRead();
  const items = list.data?.items ?? [];
  const unread = list.data?.unreadCount ?? 0;

  return (
    <>
      <PageHeader
        title="Thông báo"
        right={
          unread > 0 ? (
            <Button size="small" variant="secondary" busy={markAll.isPending} onClick={() => markAll.mutate()}>
              Đánh dấu tất cả đã đọc ({unread})
            </Button>
          ) : null
        }
      />
      <div className="section">
        <FilterTabs
          label="Lọc thông báo"
          value={filter}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'unread', label: 'Chưa đọc' },
          ]}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        />
        <FormAlert message={markAll.isError ? errorMessage(markAll.error) : null} />
      </div>
      {list.isPending ? (
        <LoadingRows rows={3} />
      ) : list.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được thông báo"
          sentence={errorMessage(list.error)}
          action={{ label: 'Thử lại', onClick: () => void list.refetch(), busy: list.isFetching }}
        />
      ) : items.length === 0 ? (
        <StateMessage
          heading={filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'}
          sentence="Thông báo về hồ sơ, booking và kết quả duyệt sẽ hiện ở đây. Thông báo được giữ 90 ngày."
        />
      ) : (
        <ul className="rows">
          {items.map((item) => (
            <NotificationRow key={item._id} item={item} />
          ))}
        </ul>
      )}
      <Pagination page={page} limit={list.data?.limit ?? PAGE_SIZE} total={list.data?.total ?? 0} onChange={setPage} />
    </>
  );
}
