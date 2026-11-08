import { useState } from 'react';

import { PAGE_SIZE } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { useAdminPlaceChanges, useDecidePlaceChange } from '../api/hooks';
import { populated, type ClaimStatus, type PlaceChangeRequest } from '../api/types';
import { DecisionForm } from '../components/DecisionForm';
import { FilterTabs, LoadingRows, PageHeader, Pagination, StateMessage, Tag } from '../components/ui';
import { describeChanges } from '../utils/changeText';
import { formatDateTime } from '../utils/format';
import { CLAIM_STATUS_LABELS } from '../utils/labels';

type Filter = ClaimStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'all', label: 'Tất cả' },
];

function ChangeRow({ request }: { request: PlaceChangeRequest }) {
  const decide = useDecidePlaceChange();
  const place = populated(request.place);
  const merchant = populated(request.merchant);
  const images = request.changes?.imagesToAdd ?? [];
  const pending = request.status === 'pending';

  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {place?.name ?? 'Quán'}
          <Tag tone={pending ? 'ink' : request.status === 'rejected' ? 'error' : 'muted'}>{CLAIM_STATUS_LABELS[request.status]}</Tag>
        </span>
        <span className="row__secondary">
          Hiện tại: {place?.address ?? 'Không rõ địa chỉ'} · Chủ quán: {merchant?.name ?? 'Không rõ'}
          {merchant?.email ? ` (${merchant.email})` : ''}
        </span>
        <div className="change-list">
          <span className="field__label">Đề nghị đổi thành</span>
          {describeChanges(request.changes).map((line) => (
            <span className="row__body" key={line}>
              {line}
            </span>
          ))}
        </div>
        {images.length ? (
          <div className="images">
            {images.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer noopener">
                <img src={url} alt={`Ảnh đề nghị cho ${place?.name ?? 'quán'}`} loading="lazy" />
              </a>
            ))}
          </div>
        ) : null}
        {request.decisionNote ? <p className="row__body">Ghi chú quyết định: {request.decisionNote}</p> : null}
        <span className="row__meta">Gửi lúc {formatDateTime(request.createdAt)}</span>
        {pending ? (
          <DecisionForm
            label="Ghi chú gửi chủ quán (bắt buộc, ít nhất 5 ký tự)"
            required
            approveLabel="Duyệt và áp dụng"
            rejectLabel="Từ chối"
            busy={decide.isPending ? (decide.variables?.status === 'approved' ? 'approve' : 'reject') : null}
            error={decide.isError ? errorMessage(decide.error) : null}
            onDecide={(decision, note) =>
              decide.mutate({ id: request._id, status: decision === 'approve' ? 'approved' : 'rejected', note })
            }
          />
        ) : null}
      </div>
    </li>
  );
}

/** `GET /api/admin/place-changes`: text and photo changes merchants asked for. Approving applies them to the place. */
export function PlaceChangesPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(1);
  const changes = useAdminPlaceChanges(filter, page);
  const items = changes.data?.items ?? [];

  return (
    <>
      <PageHeader title="Thay đổi quán" right={changes.data ? <span>{changes.data.total} đề nghị</span> : null} />
      <FilterTabs
        label="Lọc đề nghị"
        value={filter}
        options={FILTERS}
        onChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
      />
      {changes.isPending ? (
        <LoadingRows />
      ) : changes.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được đề nghị"
          sentence={errorMessage(changes.error)}
          action={{ label: 'Thử lại', onClick: () => void changes.refetch(), busy: changes.isFetching }}
        />
      ) : items.length === 0 ? (
        <StateMessage heading="Không có đề nghị" sentence="Đề nghị sửa tên, địa chỉ, mô tả, vị trí hoặc ảnh của chủ quán sẽ hiện ở đây." />
      ) : (
        <ul className="rows">
          {items.map((request) => (
            <ChangeRow key={request._id} request={request} />
          ))}
        </ul>
      )}
      <Pagination page={page} limit={changes.data?.limit ?? PAGE_SIZE} total={changes.data?.total ?? 0} onChange={setPage} />
    </>
  );
}
