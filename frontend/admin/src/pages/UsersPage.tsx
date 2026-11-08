import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { adminApi, PAGE_SIZE, type UserFilter } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { useAdminRights, useAdminUsers, useUpdateUserStatus } from '../api/hooks';
import type { AdminPermission, AdminUser, UserRole, UserStatus } from '../api/types';
import { useSession } from '../auth/sessionContext';
import { Button, FormAlert, LoadingRows, PageHeader, Pagination, Select, StateMessage, Tag, TextField } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { PERMISSION_LABELS, USER_ROLE_LABELS, USER_STATUS_LABELS } from '../utils/labels';
import { isSuperAdmin } from '../utils/permissions';
import { reasonError } from '../utils/validation';

const PERMISSIONS = Object.keys(PERMISSION_LABELS) as AdminPermission[];

function PermissionPicker({ value, onChange, disabled }: {
  value: AdminPermission[];
  onChange: (value: AdminPermission[]) => void;
  disabled: boolean;
}) {
  const all = value.includes('*');
  return (
    <fieldset className="choices" disabled={disabled}>
      <legend className="field__label">Quyền quản trị</legend>
      <div className="permission-list">
        {PERMISSIONS.map((permission) => (
          <label key={permission} className="hours__day">
            <input
              type="checkbox"
              checked={value.includes(permission)}
              disabled={disabled || (all && permission !== '*')}
              onChange={(event) =>
                onChange(
                  permission === '*'
                    ? event.target.checked
                      ? ['*']
                      : []
                    : event.target.checked
                      ? [...value, permission]
                      : value.filter((item) => item !== permission),
                )
              }
            />
            {PERMISSION_LABELS[permission]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function UserRow({ item, superAdmin, selfId }: { item: AdminUser; superAdmin: boolean; selfId: string | undefined }) {
  const status = useUpdateUserStatus();
  const rights = useAdminRights();
  const [reason, setReason] = useState('');
  const [reasonFieldError, setReasonFieldError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useQuery({ queryKey: ['admin', 'user-history', item._id],
    queryFn: () => adminApi.userHistory(item._id), enabled: historyOpen });
  const [permissions, setPermissions] = useState<AdminPermission[]>(item.adminPermissions?.length ? item.adminPermissions : ['analytics']);
  const isSelf = item._id === selfId;
  const isAdmin = item.role === 'admin';
  const deleted = item.status === 'deleted';

  function toggleStatus() {
    const error = reasonError(reason, true);
    setReasonFieldError(error);
    if (error) return;
    status.mutate({ id: item._id, status: item.status === 'suspended' ? 'active' : 'suspended', reason: reason.trim() });
  }

  function saveRights() {
    if (!permissions.length) return;
    rights.mutate(
      { kind: isAdmin ? 'permissions' : 'promote', id: item._id, permissions },
      { onSuccess: () => setEditing(false) },
    );
  }

  const shownPermissions = isAdmin ? (item.adminPermissions?.length ? item.adminPermissions : ['*' as const]) : [];

  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {item.name}
          <Tag tone={isAdmin ? 'ink' : 'muted'}>{USER_ROLE_LABELS[item.role]}</Tag>
          {item.status !== 'active' ? <Tag tone="error">{USER_STATUS_LABELS[item.status]}</Tag> : null}
          {isSelf ? <Tag>Bạn</Tag> : null}
        </span>
        <span className="row__secondary">{item.email}</span>
        {shownPermissions.length ? (
          <span className="row__secondary">Quyền: {shownPermissions.map((permission) => PERMISSION_LABELS[permission]).join(', ')}</span>
        ) : null}
        <span className="row__meta">
          <span>{item.reputation ?? 0} điểm đóng góp</span>
          <span>Tạo lúc {formatDateTime(item.createdAt)}</span>
        </span>
        {historyOpen ? (
          <div className="row__editor">
            {history.isPending ? <LoadingRows rows={1} /> : history.isError ? (
              <FormAlert message={errorMessage(history.error)} />
            ) : (
              <>
                <p className="field__hint">30 mục gần nhất mỗi loại. Booking: {history.data.bookings.length}; check-in: {history.data.checkins.length}; đánh giá: {history.data.reviews.length}; báo cáo: {history.data.reports.length}; lượt ghé xác minh: {history.data.visits.length}; cờ gian lận: {history.data.flags.length}.</p>
                <ul className="rows">
                  {history.data.bookings.slice(0, 5).map((booking) => <li key={booking._id}>Booking {booking.status} · {formatDateTime(booking.startsAt)}</li>)}
                  {history.data.checkins.slice(0, 5).map((checkin) => <li key={checkin._id}>Check-in {checkin.flagged ? 'cần rà soát' : 'hợp lệ'} · {formatDateTime(checkin.createdAt)}</li>)}
                  {history.data.reviews.slice(0, 5).map((review) => <li key={review._id}>Đánh giá {review.hidden ? 'đã ẩn' : 'đang hiện'} · {formatDateTime(review.createdAt)}</li>)}
                  {history.data.flags.slice(0, 5).map((flag) => <li key={flag._id}>Cờ gian lận {flag.status} · {formatDateTime(flag.createdAt)}</li>)}
                </ul>
              </>
            )}
          </div>
        ) : null}
        {!isAdmin && !isSelf && !deleted && item.status !== 'pending_merchant' ? (
          <TextField
            label={item.status === 'suspended' ? 'Lý do mở khóa (bắt buộc)' : 'Lý do khóa (bắt buộc)'}
            value={reason}
            maxLength={500}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonFieldError(null);
            }}
            error={reasonFieldError}
            disabled={status.isPending}
          />
        ) : null}
        {editing ? (
          <div className="row__editor">
            <PermissionPicker value={permissions} onChange={setPermissions} disabled={rights.isPending} />
            <p className="field__hint">Người được cấp quyền sẽ bị đăng xuất để nhận quyền mới.</p>
            <div className="form-actions">
              <Button size="small" busy={rights.isPending} disabled={!permissions.length} onClick={saveRights}>
                {isAdmin ? 'Lưu quyền' : 'Cấp quyền quản trị'}
              </Button>
              <Button size="small" variant="text" onClick={() => setEditing(false)} disabled={rights.isPending}>
                Hủy
              </Button>
            </div>
          </div>
        ) : null}
        <FormAlert message={status.isError ? errorMessage(status.error) : rights.isError ? errorMessage(rights.error) : null} />
      </div>
      <div className="row__actions">
        <Button size="small" variant="secondary" onClick={() => setHistoryOpen(!historyOpen)}>
          {historyOpen ? 'Ẩn lịch sử' : 'Xem lịch sử'}
        </Button>
        {!isAdmin && !isSelf && !deleted && item.status !== 'pending_merchant' ? (
          <Button
            size="small"
            variant={item.status === 'suspended' ? 'secondary' : 'danger'}
            busy={status.isPending}
            onClick={toggleStatus}>
            {item.status === 'suspended' ? 'Mở khóa' : 'Khóa tài khoản'}
          </Button>
        ) : null}
        {superAdmin && !isSelf && item.status === 'active' && !editing ? (
          <Button size="small" variant="secondary" onClick={() => setEditing(true)}>
            {isAdmin ? 'Sửa quyền' : 'Cấp quyền quản trị'}
          </Button>
        ) : null}
        {superAdmin && isAdmin && !isSelf ? (
          <Button
            size="small"
            variant="danger-text"
            busy={rights.isPending && rights.variables?.kind === 'demote'}
            onClick={() => {
              if (window.confirm(`Thu hồi quyền quản trị của ${item.name}? Tài khoản trở thành sinh viên.`)) {
                rights.mutate({ kind: 'demote', id: item._id });
              }
            }}>
            Thu hồi quyền
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** `GET /api/admin/users`: search by email, filter by role and status, suspend and manage admin rights. */
export function UsersPage() {
  const { user } = useSession();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>({ page: 1 });
  const users = useAdminUsers(filter);
  const items = users.data?.items ?? [];
  const superAdmin = isSuperAdmin(user);

  // Search as the admin types, after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter((current) => (current.q === (query.trim() || undefined) ? current : { ...current, q: query.trim() || undefined, page: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <>
      <PageHeader title="Người dùng" right={users.data ? <span>{users.data.total} tài khoản</span> : null} />
      <div className="section ops-filter">
        <TextField label="Tìm theo email" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ten@example.com" />
        <Select
          label="Vai trò"
          value={filter.role ?? ''}
          onChange={(event) => setFilter({ ...filter, role: (event.target.value || undefined) as UserRole | undefined, page: 1 })}
          options={[{ value: '', label: 'Tất cả' }, ...(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((value) => ({ value, label: USER_ROLE_LABELS[value] }))]}
        />
        <Select
          label="Trạng thái"
          value={filter.status ?? ''}
          onChange={(event) => setFilter({ ...filter, status: (event.target.value || undefined) as UserStatus | undefined, page: 1 })}
          options={[{ value: '', label: 'Tất cả' }, ...(Object.keys(USER_STATUS_LABELS) as UserStatus[]).map((value) => ({ value, label: USER_STATUS_LABELS[value] }))]}
        />
      </div>
      <p className="section field__hint">
        Khóa tài khoản sẽ đăng xuất người đó ngay. Tài khoản quản trị không khóa được ở đây; chỉ super admin cấp hoặc thu hồi quyền quản trị.
      </p>
      {users.isPending ? (
        <LoadingRows />
      ) : users.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được người dùng"
          sentence={errorMessage(users.error)}
          action={{ label: 'Thử lại', onClick: () => void users.refetch(), busy: users.isFetching }}
        />
      ) : items.length === 0 ? (
        <StateMessage heading="Không có tài khoản phù hợp" sentence="Thử email khác hoặc bỏ bớt bộ lọc." />
      ) : (
        <ul className="rows">
          {items.map((item) => (
            <UserRow key={item._id} item={item} superAdmin={superAdmin} selfId={user?.id} />
          ))}
        </ul>
      )}
      <Pagination
        page={filter.page}
        limit={users.data?.limit ?? PAGE_SIZE}
        total={users.data?.total ?? 0}
        onChange={(page) => setFilter({ ...filter, page })}
      />
    </>
  );
}
