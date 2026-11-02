import { useSearchParams } from 'react-router';

import { PAGE_SIZE } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { useReviews, useUpdateReview } from '../api/hooks';
import { populated, type Review } from '../api/types';
import { Button, FilterTabs, FormAlert, LoadingRows, PageHeader, Pagination, Stars, StateMessage, Tag } from '../components/ui';
import { formatDateTime } from '../utils/format';

type Filter = 'all' | 'visible' | 'hidden';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'visible', label: 'Đang hiện' },
  { value: 'hidden', label: 'Đã ẩn' },
];

const EMPTY_TEXT: Record<Filter, { heading: string; sentence: string }> = {
  all: { heading: 'Chưa có đánh giá nào', sentence: 'Đánh giá của sinh viên sẽ hiện ở đây.' },
  visible: { heading: 'Không có đánh giá đang hiện', sentence: 'Đánh giá chưa bị ẩn sẽ hiện ở đây.' },
  hidden: { heading: 'Không có đánh giá bị ẩn', sentence: 'Đánh giá bạn ẩn sẽ hiện ở đây và có thể hiện lại.' },
};

function readFilter(value: string | null): Filter {
  return FILTERS.some((f) => f.value === value) ? (value as Filter) : 'all';
}

function ReviewRow({ review }: { review: Review }) {
  const update = useUpdateReview();
  const place = populated(review.place);
  const user = populated(review.user);
  const hidden = Boolean(review.hidden);

  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {place?.name ?? 'Địa điểm đã xoá'}
          <Stars value={review.rating ?? 0} />
          {hidden ? <Tag tone="error">Đã ẩn</Tag> : null}
        </span>
        {review.text ? <p className="row__body">{review.text}</p> : null}
        <span className="row__meta">
          <span>
            {user?.name ?? 'Không rõ'}
            {user?.email ? ` (${user.email})` : ''}
          </span>
          <span>{formatDateTime(review.createdAt)}</span>
        </span>
      </div>
      <div className="row__actions">
        <Button
          variant={hidden ? 'secondary' : 'danger'}
          size="small"
          busy={update.isPending}
          busyLabel={hidden ? 'Đang hiện lại' : 'Đang ẩn'}
          onClick={() => update.mutate({ id: review._id as string, hidden: !hidden })}>
          {hidden ? 'Hiện lại' : 'Ẩn đánh giá'}
        </Button>
      </div>
      {update.isError ? (
        <div className="row__error">
          <FormAlert message={errorMessage(update.error)} />
        </div>
      ) : null}
    </li>
  );
}

export function ReviewsPage() {
  const [params, setParams] = useSearchParams();
  const filter = readFilter(params.get('visibility'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const reviews = useReviews(filter, page);

  function go(next: { visibility?: Filter; page?: number }) {
    const search = new URLSearchParams();
    search.set('visibility', next.visibility ?? filter);
    if ((next.page ?? 1) > 1) search.set('page', String(next.page));
    setParams(search);
  }

  const items = reviews.data?.items ?? [];

  let body;
  if (reviews.isPending) {
    body = <LoadingRows />;
  } else if (reviews.isError && !reviews.data) {
    body = (
      <StateMessage
        tone="error"
        heading="Chưa tải được đánh giá"
        sentence={errorMessage(reviews.error)}
        action={{ label: 'Thử lại', onClick: () => void reviews.refetch(), busy: reviews.isFetching }}
      />
    );
  } else if (!items.length) {
    body = <StateMessage {...EMPTY_TEXT[filter]} />;
  } else {
    body = (
      <>
        <ul className="rows" aria-busy={reviews.isFetching || undefined}>
          {items.map((review) => (
            <ReviewRow key={review._id} review={review} />
          ))}
        </ul>
        <Pagination page={page} limit={reviews.data?.limit ?? PAGE_SIZE} total={reviews.data?.total ?? 0} onChange={(next) => go({ page: next })} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Đánh giá" right={reviews.data ? `${reviews.data.total ?? 0} đánh giá` : undefined} />
      <p className="section row__secondary">Ẩn một đánh giá sẽ bỏ nó khỏi điểm trung bình của địa điểm. Người viết không sửa được đánh giá đã bị ẩn.</p>
      <FilterTabs label="Lọc theo hiển thị" value={filter} options={FILTERS} onChange={(value) => go({ visibility: value })} />
      {body}
    </>
  );
}
