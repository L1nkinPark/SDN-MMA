import { useState } from 'react';

import { PAGE_SIZE } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { useDecideFraudFlag, useFraudFlags } from '../api/hooks';
import { populated, type FraudFlag, type FraudStatus } from '../api/types';
import { DecisionForm } from '../components/DecisionForm';
import { FilterTabs, LoadingRows, PageHeader, Pagination, StateMessage, Tag } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { FRAUD_STATUS_LABELS, fraudDetailText } from '../utils/labels';

type Filter = FraudStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Chờ rà soát' },
  { value: 'resolved', label: 'Đã xác nhận' },
  { value: 'dismissed', label: 'Đã bỏ cờ' },
  { value: 'all', label: 'Tất cả' },
];

function FlagRow({ flag }: { flag: FraudFlag }) {
  const decide = useDecideFraudFlag();
  const user = populated(flag.user);
  const place = populated(flag.place);
  const pending = flag.status === 'pending';

  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {user?.name ?? 'Người dùng'}
          <Tag tone={pending ? 'ink' : flag.status === 'resolved' ? 'error' : 'muted'}>{FRAUD_STATUS_LABELS[flag.status]}</Tag>
        </span>
        <span className="row__secondary">
          {user?.email ? `${user.email} · ` : ''}Check-in tại {place?.name ?? 'địa điểm'}
          {place?.address ? `, ${place.address}` : ''}
        </span>
        <p className="row__body">{fraudDetailText(flag.detail)}</p>
        <span className="row__meta">{formatDateTime(flag.createdAt)}</span>
        {pending ? (
          <DecisionForm
            label="Ghi chú cho nhật ký (không bắt buộc)"
            required={false}
            approveLabel="Xác nhận gian lận"
            rejectLabel="Bỏ cờ"
            busy={decide.isPending ? (decide.variables?.status === 'resolved' ? 'approve' : 'reject') : null}
            error={decide.isError ? errorMessage(decide.error) : null}
            onDecide={(decision, note) =>
              decide.mutate({ id: flag._id, status: decision === 'approve' ? 'resolved' : 'dismissed', reason: note || undefined })
            }
          />
        ) : null}
      </div>
    </li>
  );
}

/** `GET /api/admin/fraud-flags`: check-ins flagged for impossible travel. */
export function FraudPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(1);
  const flags = useFraudFlags(filter, page);
  const items = flags.data?.items ?? [];

  return (
    <>
      <PageHeader title="Check-in bất thường" right={flags.data ? <span>{flags.data.total} cờ</span> : null} />
      <FilterTabs
        label="Lọc cờ"
        value={filter}
        options={FILTERS}
        onChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
      />
      <p className="section field__hint">
        Check-in bị gắn cờ không được tính vào trạng thái trực tiếp và không được cộng điểm. Bỏ cờ sẽ tính lại check-in đó và cộng điểm cho người dùng;
        xác nhận gian lận giữ nguyên việc loại check-in. Kiểm tra cờ trước khi tin báo cáo hoặc đánh giá của người đó.
      </p>
      {flags.isPending ? (
        <LoadingRows />
      ) : flags.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được danh sách"
          sentence={errorMessage(flags.error)}
          action={{ label: 'Thử lại', onClick: () => void flags.refetch(), busy: flags.isFetching }}
        />
      ) : items.length === 0 ? (
        <StateMessage heading="Không có cờ nào" sentence="Check-in di chuyển bất thường sẽ hiện ở đây." />
      ) : (
        <ul className="rows">
          {items.map((flag) => (
            <FlagRow key={flag._id} flag={flag} />
          ))}
        </ul>
      )}
      <Pagination page={page} limit={flags.data?.limit ?? PAGE_SIZE} total={flags.data?.total ?? 0} onChange={setPage} />
    </>
  );
}
