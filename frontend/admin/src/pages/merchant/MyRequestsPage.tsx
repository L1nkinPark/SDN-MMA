import { useState } from 'react';

import { PAGE_SIZE } from '../../api/endpoints';
import { errorMessage } from '../../api/errors';
import { useMerchantChanges } from '../../api/hooks';
import { populated, type PlaceChangeRequest } from '../../api/types';
import { LoadingRows, PageHeader, Pagination, StateMessage, Tag } from '../../components/ui';
import { describeChanges } from '../../utils/changeText';
import { formatDateTime } from '../../utils/format';
import { CLAIM_STATUS_LABELS } from '../../utils/labels';

function RequestRow({ request }: { request: PlaceChangeRequest }) {
  const place = populated(request.place);
  const images = request.changes?.imagesToAdd ?? [];
  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {place?.name ?? 'Quán'}
          <Tag tone={request.status === 'approved' ? 'ink' : request.status === 'rejected' ? 'error' : 'muted'}>
            {CLAIM_STATUS_LABELS[request.status]}
          </Tag>
        </span>
        {describeChanges(request.changes).map((line) => (
          <span className="row__body" key={line}>
            {line}
          </span>
        ))}
        {images.length ? (
          <div className="images">
            {images.map((url) => (
              <img key={url} src={url} alt="Ảnh đề nghị" />
            ))}
          </div>
        ) : null}
        {request.decisionNote ? <p className="row__body">Phản hồi: {request.decisionNote}</p> : null}
        <span className="row__meta">Gửi lúc {formatDateTime(request.createdAt)}</span>
      </div>
    </li>
  );
}

/** `GET /api/merchant/change-requests/me`: text and photo changes and their result. */
export function MyRequestsPage() {
  const [page, setPage] = useState(1);
  const requests = useMerchantChanges(page);
  const items = requests.data?.items ?? [];
  return (
    <>
      <PageHeader title="Đề nghị đã gửi" />
      {requests.isPending ? (
        <LoadingRows rows={3} />
      ) : requests.isError ? (
        <StateMessage
          tone="error"
          heading="Chưa tải được đề nghị"
          sentence={errorMessage(requests.error)}
          action={{ label: 'Thử lại', onClick: () => void requests.refetch(), busy: requests.isFetching }}
        />
      ) : items.length === 0 ? (
        <StateMessage heading="Chưa có đề nghị nào" sentence="Đề nghị sửa thông tin hoặc ảnh quán sẽ hiện ở đây kèm kết quả duyệt." />
      ) : (
        <ul className="rows">
          {items.map((request) => (
            <RequestRow key={request._id} request={request} />
          ))}
        </ul>
      )}
      <Pagination page={page} limit={requests.data?.limit ?? PAGE_SIZE} total={requests.data?.total ?? 0} onChange={setPage} />
    </>
  );
}
