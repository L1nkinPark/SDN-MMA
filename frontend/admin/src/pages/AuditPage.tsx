import { useState } from 'react';

import { PAGE_SIZE } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { useAudit } from '../api/hooks';
import { populated } from '../api/types';
import { LoadingRows, PageHeader, Pagination, StateMessage } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { auditActionLabel, PERMISSION_LABELS, targetLabel } from '../utils/labels';

/** Permission lists are stored as "users,places" in the audit detail; everything else is the note as written. */
function detailText(action: string, detail: string | null): string | null {
  if (!detail) return null;
  if (action === 'admin.promote' || action === 'admin.permissions') {
    return `Quyền: ${detail
      .split(',')
      .map((item) => PERMISSION_LABELS[item as keyof typeof PERMISSION_LABELS] ?? item)
      .join(', ')}`;
  }
  return detail;
}

/** `GET /api/admin/audit`: newest admin actions first. */
export function AuditPage() {
  const [page, setPage] = useState(1);
  const audit = useAudit(page);
  const items = audit.data?.items ?? [];

  return (
    <>
      <PageHeader title="Nhật ký quản trị" right={audit.data ? <span>{audit.data.total} sự kiện</span> : null} />
      {audit.isPending ? (
        <LoadingRows />
      ) : audit.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được nhật ký"
          sentence={errorMessage(audit.error)}
          action={{ label: 'Thử lại', onClick: () => void audit.refetch(), busy: audit.isFetching }}
        />
      ) : items.length === 0 ? (
        <StateMessage heading="Chưa có sự kiện" sentence="Các thao tác duyệt, khóa, hủy và phân quyền sẽ được ghi ở đây." />
      ) : (
        <ul className="rows">
          {items.map((event) => {
            const actor = populated(event.actor);
            const detail = detailText(event.action, event.detail);
            return (
              <li className="row" key={event._id}>
                <div className="row__main">
                  <span className="row__title">{auditActionLabel(event.action)}</span>
                  <span className="row__secondary">
                    {actor?.name ?? 'Quản trị viên'}
                    {actor?.email ? ` (${actor.email})` : ''} · {targetLabel(event.targetType)} {event.targetId}
                  </span>
                  {detail ? <p className="row__body">{detail}</p> : null}
                  <span className="row__meta">{formatDateTime(event.createdAt)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} limit={audit.data?.limit ?? PAGE_SIZE} total={audit.data?.total ?? 0} onChange={setPage} />
    </>
  );
}
