import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { adminApi, PAGE_SIZE } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { populated, type SupportCase } from '../api/types';
import { formatDateTime } from '../utils/format';
import { Button, FormAlert, LoadingRows, Pagination, Select, StateMessage, TextField } from './ui';

function CaseRow({ item, kind }: { item: SupportCase; kind: SupportCase['kind'] }) {
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();
  const decide = useMutation({ mutationFn: (status: 'accepted' | 'rejected') =>
    adminApi.decideCase(kind, item._id, status, note.trim()),
  onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin', 'cases', kind] }); } });
  const user = populated(item.user);
  return <li className="row">
    <div className="row__main">
      <span className="row__title">{user?.name || 'Người dùng'} · {item.status}</span>
      <span className="row__secondary">{user?.email} · {formatDateTime(item.createdAt)}</span>
      <p className="row__body">{item.reason}</p>
      <span className="row__meta">Mã đối tượng: {item.targetId}</span>
      {item.decisionNote ? <p className="row__body">Kết quả: {item.decisionNote}</p> : null}
      {item.status === 'pending' ? <TextField label="Kết luận và căn cứ (ít nhất 20 ký tự)" value={note}
        maxLength={2000} onChange={(event) => setNote(event.target.value)} disabled={decide.isPending} /> : null}
      <FormAlert message={decide.isError ? errorMessage(decide.error) : null} />
    </div>
    {item.status === 'pending' ? <div className="row__actions">
      <Button size="small" busy={decide.isPending} disabled={note.trim().length < 20}
        onClick={() => decide.mutate('accepted')}>Chấp nhận</Button>
      <Button size="small" variant="danger" busy={decide.isPending} disabled={note.trim().length < 20}
        onClick={() => decide.mutate('rejected')}>Từ chối</Button>
    </div> : null}
  </li>;
}

export function CasesPanel({ kind }: { kind: SupportCase['kind'] }) {
  const [status, setStatus] = useState<'all' | SupportCase['status']>('pending');
  const [page, setPage] = useState(1);
  const cases = useQuery({ queryKey: ['admin', 'cases', kind, status, page],
    queryFn: () => adminApi.listCases(kind, page, status === 'all' ? undefined : status) });
  return <div className="section">
    <h2>{kind === 'review_appeal' ? 'Khiếu nại đánh giá' : 'Khiếu nại booking không đến'}</h2>
    <p className="field__hint">Chỉ chấp nhận khi đã kiểm tra bằng chứng. Quyết định được lưu nhật ký và gửi cho người dùng.</p>
    <Select label="Trạng thái khiếu nại" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}
      options={[{ value: 'pending', label: 'Chờ xử lý' }, { value: 'accepted', label: 'Đã chấp nhận' },
        { value: 'rejected', label: 'Đã từ chối' }, { value: 'all', label: 'Tất cả' }]} />
    {cases.isPending ? <LoadingRows rows={1} /> : cases.isError ?
      <StateMessage tone="error" heading="Chưa tải được khiếu nại" sentence={errorMessage(cases.error)}
        action={{ label: 'Thử lại', onClick: () => void cases.refetch() }} /> :
      cases.data.items.length ? <ul className="rows">{cases.data.items.map((item) =>
        <CaseRow key={item._id} item={item} kind={kind} />)}</ul> :
        <StateMessage heading="Không có khiếu nại" sentence="Các hồ sơ ở trạng thái này sẽ hiện tại đây." />}
    <Pagination page={page} limit={cases.data?.limit ?? PAGE_SIZE} total={cases.data?.total ?? 0} onChange={setPage} />
  </div>;
}
