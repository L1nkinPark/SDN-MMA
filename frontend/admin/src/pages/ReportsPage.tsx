import { useSearchParams } from 'react-router';
import { useState } from 'react';

import { PAGE_SIZE } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { useReports, useUpdateReport } from '../api/hooks';
import { populated, type Report, type ReportStatus } from '../api/types';
import { Button, FilterTabs, FormAlert, LoadingRows, PageHeader, Pagination, StateMessage, Tag, TextField } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from '../utils/labels';

type Filter = ReportStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'dismissed', label: 'Đã bỏ qua' },
  { value: 'all', label: 'Tất cả' },
];

const EMPTY_TEXT: Record<Filter, { heading: string; sentence: string }> = {
  pending: { heading: 'Không có báo cáo chờ xử lý', sentence: 'Báo cáo mới của sinh viên sẽ hiện ở đây.' },
  resolved: { heading: 'Chưa có báo cáo đã xử lý', sentence: 'Báo cáo bạn đánh dấu đã xử lý sẽ hiện ở đây.' },
  dismissed: { heading: 'Chưa có báo cáo bị bỏ qua', sentence: 'Báo cáo bạn bỏ qua sẽ hiện ở đây.' },
  all: { heading: 'Chưa có báo cáo nào', sentence: 'Khi sinh viên báo cáo một địa điểm, báo cáo sẽ hiện ở đây.' },
};

function readFilter(value: string | null): Filter {
  return FILTERS.some((f) => f.value === value) ? (value as Filter) : 'pending';
}

function ReportRow({ report }: { report: Report }) {
  const update = useUpdateReport();
  const place = populated(report.place);
  const user = populated(report.user);
  const status = report.status ?? 'pending';
  const [reason, setReason] = useState('');

  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {REPORT_REASON_LABELS[report.reason ?? 'other']}
          <Tag tone={status === 'pending' ? 'ink' : 'muted'}>{REPORT_STATUS_LABELS[status]}</Tag>
        </span>
        <span className="row__secondary">
          {place?.name ?? 'Địa điểm đã xoá'}
          {place?.address ? ` · ${place.address}` : ''}
        </span>
        {report.detail ? <p className="row__body">{report.detail}</p> : null}
        {report.resolutionNote ? <p className="row__body">Xử lý: {report.resolutionNote}</p> : null}
        {status === 'pending' ? <TextField label="Lý do xử lý (ít nhất 5 ký tự)" value={reason} onChange={e => setReason(e.target.value)} /> : null}
        <span className="row__meta">
          <span>
            Người báo: {user?.name ?? 'Không rõ'}
            {user?.email ? ` (${user.email})` : ''}
          </span>
          <span>{formatDateTime(report.createdAt)}</span>
        </span>
      </div>
      <div className="row__actions">
        {status === 'pending' ? (
          <>
            <Button
              size="small"
              busy={update.isPending && update.variables?.status === 'resolved'}
              disabled={update.isPending || reason.trim().length < 5}
              onClick={() => update.mutate({ id: report._id as string, status: 'resolved', reason: reason.trim() })}>
              Đã xử lý
            </Button>
            <Button
              variant="secondary"
              size="small"
              busy={update.isPending && update.variables?.status === 'dismissed'}
              disabled={update.isPending || reason.trim().length < 5}
              onClick={() => update.mutate({ id: report._id as string, status: 'dismissed', reason: reason.trim() })}>
              Bỏ qua
            </Button>
          </>
        ) : null}
      </div>
      {update.isError ? (
        <div className="row__error">
          <FormAlert message={errorMessage(update.error)} />
        </div>
      ) : null}
    </li>
  );
}

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const filter = readFilter(params.get('status'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const reports = useReports(filter, page);

  function go(next: { status?: Filter; page?: number }) {
    const search = new URLSearchParams();
    search.set('status', next.status ?? filter);
    if ((next.page ?? 1) > 1) search.set('page', String(next.page));
    setParams(search);
  }

  const items = reports.data?.items ?? [];

  let body;
  if (reports.isPending) {
    body = <LoadingRows />;
  } else if (reports.isError && !reports.data) {
    body = (
      <StateMessage
        tone="error"
        heading="Chưa tải được báo cáo"
        sentence={errorMessage(reports.error)}
        action={{ label: 'Thử lại', onClick: () => void reports.refetch(), busy: reports.isFetching }}
      />
    );
  } else if (!items.length) {
    body = <StateMessage {...EMPTY_TEXT[filter]} />;
  } else {
    body = (
      <>
        <ul className="rows" aria-busy={reports.isFetching || undefined}>
          {items.map((report) => (
            <ReportRow key={report._id} report={report} />
          ))}
        </ul>
        <Pagination page={page} limit={reports.data?.limit ?? PAGE_SIZE} total={reports.data?.total ?? 0} onChange={(next) => go({ page: next })} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Báo cáo" right={reports.data ? `${reports.data.total ?? 0} báo cáo` : undefined} />
      <FilterTabs label="Lọc theo trạng thái" value={filter} options={FILTERS} onChange={(value) => go({ status: value })} />
      {body}
    </>
  );
}
