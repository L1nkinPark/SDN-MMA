import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import { useSession } from '../auth/sessionContext';
import { Button, FormAlert, LoadingRows, PageHeader, Pagination, StateMessage, TextField } from '../components/ui';

type Ref = string | { _id: string; name?: string; email?: string; address?: string } | null;
type Item = { _id: string; createdAt?: string; startsAt?: string; name?: string; email?: string; role?: string;
  status?: string; reason?: string; decisionNote?: string; businessName?: string; contactPhone?: string;
  evidenceUrls?: string[]; changes?: Record<string, unknown>; partySize?: number; detail?: string; action?: string;
  user?: Ref; applicant?: Ref; merchant?: Ref; actor?: Ref; place?: Ref; targetType?: string; targetId?: string;
  adminPermissions?: string[]; onboardingEvidenceUrls?: string[] };
type Page = { items: Item[]; total: number; page: number; limit: number };
type Kind = 'users' | 'claims' | 'place-changes' | 'bookings' | 'fraud' | 'audit';
const config: Record<Kind, { title: string; path: string; statuses?: string[] }> = {
  users: { title: 'Người dùng', path: '/api/admin/users', statuses: ['active', 'suspended'] },
  claims: { title: 'Hồ sơ chủ quán', path: '/api/admin/merchant-claims', statuses: ['pending', 'approved', 'rejected'] },
  'place-changes': { title: 'Thay đổi thông tin quán', path: '/api/admin/place-changes', statuses: ['pending', 'approved', 'rejected'] },
  bookings: { title: 'Đặt chỗ', path: '/api/admin/bookings', statuses: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'] },
  fraud: { title: 'Check-in bất thường', path: '/api/admin/fraud-flags', statuses: ['pending', 'resolved', 'dismissed'] },
  audit: { title: 'Nhật ký quản trị', path: '/api/admin/audit' },
};
function ref(value: Ref | undefined) { return typeof value === 'string' ? value : value?.name || value?.email || value?._id || '—'; }
function when(value?: string) { return value ? new Date(value).toLocaleString('vi-VN') : '—'; }

export function OperationsPage({ kind }: { kind: Kind }) {
  const spec = config[kind];
  const { user } = useSession();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(kind === 'claims' || kind === 'place-changes' || kind === 'fraud' ? 'pending' : '');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const key = ['admin-operation', kind, page, status, search];
  const list = useQuery({ queryKey: key, queryFn: () => api.request<Page>(spec.path, {
    query: { page, limit: 20, ...(kind === 'users' ? { q: search || undefined } : {}), status: status || undefined }
  }) });
  const mutation = useMutation({
    mutationFn: async ({ path, body, method = 'PATCH' }: { path: string; body?: unknown; method?: 'PATCH' | 'POST' | 'DELETE' }) =>
      api.request(path, { method, body }),
    onSuccess: async () => { setNotice('Đã lưu thay đổi.'); await client.invalidateQueries({ queryKey: ['admin-operation'] }); },
  });
  const act = (path: string, body?: unknown, method?: 'PATCH' | 'POST' | 'DELETE') => {
    setNotice(''); mutation.mutate({ path, body, method });
  };
  const decision = (item: Item, next: 'approved' | 'rejected') => {
    const decisionNote = note[item._id]?.trim() || '';
    if (decisionNote.length < 5) { setNotice('Ghi lý do ít nhất 5 ký tự trước khi quyết định.'); return; }
    act(`${spec.path}/${item._id}`, { status: next, decisionNote });
  };
  const items = list.data?.items ?? [];
  return <>
    <PageHeader title={spec.title} right={<span>{list.data?.total ?? 0} mục</span>} />
    <div className="section ops-filter">
      {spec.statuses ? <label className="field">Trạng thái <select className="field__input" value={status}
        onChange={e => { setStatus(e.target.value); setPage(1); }}>
        <option value="">Tất cả</option>{spec.statuses.map(s => <option key={s} value={s}>{s}</option>)}
      </select></label> : null}
      {kind === 'users' ? <TextField label="Tìm theo email" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /> : null}
    </div>
    <div className="section"><FormAlert message={mutation.isError ? errorMessage(mutation.error) : notice} /></div>
    {list.isPending ? <LoadingRows /> : list.isError ? <StateMessage tone="error" heading="Không tải được dữ liệu" sentence={errorMessage(list.error)}
      action={{ label: 'Thử lại', onClick: () => void list.refetch() }} /> : items.length === 0 ?
      <StateMessage heading="Không có mục nào" sentence="Hãy đổi bộ lọc hoặc quay lại sau." /> :
      <ul className="rows">{items.map(item => <li className="row" key={item._id}>
        <div className="row__main">
          <strong className="row__title">{kind === 'users' ? item.name || item.email :
            kind === 'audit' ? item.action : kind === 'bookings' ? ref(item.place) :
            kind === 'fraud' ? `${ref(item.user)} · ${ref(item.place)}` : item.businessName || ref(item.place)}
            {item.status ? <small className="tag tag--muted">{item.status}</small> : null}</strong>
          <span className="row__secondary">{kind === 'users' ? `${item.email} · ${item.role}` :
            kind === 'audit' ? `${ref(item.actor)} · ${item.targetType || ''} ${item.targetId || ''}` :
            kind === 'bookings' ? `${ref(item.user)} · ${item.partySize || 1} khách · ${when(item.startsAt)}` :
            `${ref(item.applicant || item.merchant || item.user)} · ${when(item.createdAt)}`}</span>
          {item.reason || item.detail || item.decisionNote ? <p className="row__body">{item.reason || item.detail || item.decisionNote}</p> : null}
          {item.changes ? <p className="row__body">Thay đổi: {JSON.stringify(item.changes)}</p> : null}
          {item.evidenceUrls?.map(url => <a key={url} href={url} target="_blank" rel="noreferrer">Minh chứng: {url}</a>)}
          {kind === 'users' && item.role === 'admin' ? <p className="row__meta">Quyền: {item.adminPermissions?.join(', ') || 'Xem trong hồ sơ admin'}</p> : null}
          {kind === 'users' && user?.adminPermissions?.includes('*') ?
            <TextField label="Quyền admin (cách nhau bằng dấu phẩy: users, places, moderation, bookings, fraud, audit, analytics hoặc *)"
              value={note[item._id] ?? item.adminPermissions?.join(', ') ?? 'analytics'}
              onChange={e => setNote(current => ({ ...current, [item._id]: e.target.value }))} /> : null}
          {(kind === 'users' && item.role !== 'admin' || kind === 'fraud' && item.status === 'pending') ?
            <TextField label="Lý do quyết định (ít nhất 5 ký tự)" value={reasons[item._id] || ''}
              onChange={e => setReasons(current => ({ ...current, [item._id]: e.target.value }))} /> : null}
          {(kind === 'claims' || kind === 'place-changes') && item.status === 'pending' ?
            <TextField label="Lý do quyết định (bắt buộc)" value={note[item._id] || ''}
              onChange={e => setNote(current => ({ ...current, [item._id]: e.target.value }))} /> : null}
          {kind === 'bookings' && ['pending', 'confirmed'].includes(item.status || '') ?
            <TextField label="Lý do hủy booking" value={note[item._id] || ''}
              onChange={e => setNote(current => ({ ...current, [item._id]: e.target.value }))} /> : null}
        </div>
        <div className="row__actions">
          {kind === 'users' && item.role !== 'admin' && item._id !== user?.id ? <>
            <Button size="small" variant="secondary" disabled={(reasons[item._id] || '').trim().length < 5}
              onClick={() => act(`${spec.path}/${item._id}`, { status: item.status === 'suspended' ? 'active' : 'suspended', reason: reasons[item._id].trim() })}>
              {item.status === 'suspended' ? 'Mở khóa' : 'Tạm khóa'}</Button>
            {item.status === 'active' && user?.adminPermissions?.includes('*') ?
              <Button size="small" variant="secondary" onClick={() => act('/api/admin/admins', { userId: item._id, permissions: (note[item._id] || 'analytics').split(',').map(s => s.trim()).filter(Boolean) }, 'POST')}>
                Cấp quyền admin</Button> : null}</> : null}
          {kind === 'users' && item.role === 'admin' && item._id !== user?.id && user?.adminPermissions?.includes('*') ? <>
            <Button size="small" variant="secondary" onClick={() => act(`/api/admin/admins/${item._id}/permissions`,
              { permissions: (note[item._id] ?? item.adminPermissions?.join(', ') ?? '').split(',').map(s => s.trim()).filter(Boolean) })}>Lưu quyền</Button>
            <Button size="small" variant="danger" onClick={() => act(`/api/admin/admins/${item._id}`, undefined, 'DELETE')}>Thu hồi admin</Button>
          </> : null}
          {(kind === 'claims' || kind === 'place-changes') && item.status === 'pending' ? <>
            <Button size="small" onClick={() => decision(item, 'approved')}>Duyệt</Button>
            <Button size="small" variant="danger" onClick={() => decision(item, 'rejected')}>Từ chối</Button></> : null}
          {kind === 'fraud' && item.status === 'pending' ? <>
            <Button size="small" disabled={(reasons[item._id] || '').trim().length < 5}
              onClick={() => act(`${spec.path}/${item._id}`, { status: 'resolved', reason: reasons[item._id].trim() })}>Xác nhận gian lận</Button>
            <Button size="small" variant="secondary" disabled={(reasons[item._id] || '').trim().length < 5}
              onClick={() => act(`${spec.path}/${item._id}`, { status: 'dismissed', reason: reasons[item._id].trim() })}>Bỏ cờ</Button></> : null}
          {kind === 'bookings' && ['pending', 'confirmed'].includes(item.status || '') ?
            <Button size="small" variant="danger" onClick={() => {
              const reason = note[item._id]?.trim() || '';
              if (reason.length < 5) { setNotice('Ghi lý do hủy ít nhất 5 ký tự.'); return; }
              act(`${spec.path}/${item._id}/cancel`, { reason }, 'POST');
            }}>Hủy booking</Button> : null}
        </div>
      </li>)}</ul>}
    <Pagination page={page} limit={list.data?.limit || 20} total={list.data?.total || 0} onChange={setPage} />
  </>;
}
