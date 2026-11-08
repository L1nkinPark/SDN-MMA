import { useState } from 'react';

import { PAGE_SIZE } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { useAdminClaims, useDecideClaim } from '../api/hooks';
import { populated, type ClaimStatus, type MerchantClaim } from '../api/types';
import { DecisionForm } from '../components/DecisionForm';
import { FilterTabs, LoadingRows, PageHeader, Pagination, StateMessage, Tag } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { CLAIM_STATUS_LABELS } from '../utils/labels';

type Filter = ClaimStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'all', label: 'Tất cả' },
];

function ClaimRow({ claim }: { claim: MerchantClaim }) {
  const decide = useDecideClaim();
  const applicant = populated(claim.applicant);
  const place = populated(claim.place);
  const isAccount = claim.kind === 'account';
  const status = claim.status ?? 'pending';
  const createdAt = (claim as { createdAt?: string }).createdAt;

  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {isAccount ? 'Tài khoản chủ quán' : place?.name ?? 'Địa điểm'}
          <Tag tone={status === 'pending' ? 'ink' : status === 'rejected' ? 'error' : 'muted'}>{CLAIM_STATUS_LABELS[status]}</Tag>
        </span>
        <span className="row__secondary">{isAccount ? 'Duyệt tài khoản trước khi người này được đăng ký hoặc nhận quyền quán' : place?.address}</span>
        <p className="row__body">
          {claim.businessName} · {claim.contactPhone}
          {'\n'}Người gửi: {applicant?.name ?? 'Không rõ'}
          {applicant?.email ? ` (${applicant.email})` : ''}
        </p>
        <ul className="link-list">
          {(claim.evidenceUrls ?? []).map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer noopener">
                {url}
              </a>
            </li>
          ))}
        </ul>
        {claim.decisionNote ? <p className="row__body">Ghi chú quyết định: {claim.decisionNote}</p> : null}
        <span className="row__meta">{createdAt ? `Gửi lúc ${formatDateTime(createdAt)}` : null}</span>
        {status === 'pending' && claim._id ? (
          <DecisionForm
            label="Ghi chú gửi người nộp hồ sơ (bắt buộc, ít nhất 5 ký tự)"
            required
            approveLabel={isAccount ? 'Duyệt tài khoản chủ quán' : 'Duyệt quyền quản lý quán'}
            rejectLabel="Từ chối"
            busy={decide.isPending ? (decide.variables?.status === 'approved' ? 'approve' : 'reject') : null}
            error={decide.isError ? errorMessage(decide.error) : null}
            onDecide={(decision, note) =>
              decide.mutate({ id: claim._id as string, status: decision === 'approve' ? 'approved' : 'rejected', note })
            }
          />
        ) : null}
      </div>
    </li>
  );
}

/** Account applications grant merchant role; place claims assign an already approved merchant to a place. */
export function ClaimsPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(1);
  const claims = useAdminClaims(filter, page);
  const items = claims.data?.items ?? [];

  return (
    <>
      <PageHeader title="Hồ sơ chủ quán" right={claims.data ? <span>{claims.data.total} hồ sơ</span> : null} />
      <FilterTabs
        label="Lọc hồ sơ"
        value={filter}
        options={FILTERS}
        onChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
      />
      <p className="section field__hint">
        Duyệt hồ sơ tài khoản trước để cấp quyền chủ quán. Hồ sơ nhận quyền một quán đã có được xét riêng tại đây;
        quán mới do chủ quán đăng ký được duyệt tại mục Địa điểm.
      </p>
      {claims.isPending ? (
        <LoadingRows />
      ) : claims.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được hồ sơ"
          sentence={errorMessage(claims.error)}
          action={{ label: 'Thử lại', onClick: () => void claims.refetch(), busy: claims.isFetching }}
        />
      ) : items.length === 0 ? (
        <StateMessage heading="Không có hồ sơ" sentence="Hồ sơ nhận quyền quản lý quán sẽ hiện ở đây." />
      ) : (
        <ul className="rows">
          {items.map((claim) => (
            <ClaimRow key={claim._id} claim={claim} />
          ))}
        </ul>
      )}
      <Pagination page={page} limit={claims.data?.limit ?? PAGE_SIZE} total={claims.data?.total ?? 0} onChange={setPage} />
    </>
  );
}
