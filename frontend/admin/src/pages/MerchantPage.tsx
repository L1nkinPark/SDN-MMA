import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import { Button, FormAlert, LoadingRows, PageHeader, Select, StateMessage, TextArea, TextField } from '../components/ui';

type Place = { _id: string; name: string; address: string; approval: string; amenities?: { wifi?: boolean | null; outlets?: boolean | null };
  minDrinkPrice?: number | null; business?: { phone?: string; temporaryClosed?: boolean; seatingCapacity?: number | null;
  openingHours?: { day: number; open: string; close: string }[] };
  booking?: { enabled?: boolean; approvalMode?: 'auto' | 'manual'; capacityPerSlot?: number; slotMinutes?: number } };
type Booking = { _id: string; status: string; startsAt: string; partySize: number; note?: string; user?: { name?: string; email?: string } };
type Claim = { _id: string; status: string; place?: { name?: string }; decisionNote?: string };
const enc = encodeURIComponent;
const DAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function OpeningHours({ place, save }: { place: Place; save: (hours: { day: number; open: string; close: string }[]) => void }) {
  const [hours, setHours] = useState(() => DAYS.map((_, day) => ({ day,
    enabled: !!place.business?.openingHours?.find(h => h.day === day),
    open: place.business?.openingHours?.find(h => h.day === day)?.open || '08:00',
    close: place.business?.openingHours?.find(h => h.day === day)?.close || '22:00' })));
  return <div className="merchant-hours"><h3>Giờ mở cửa để nhận booking</h3>
    {hours.map((h, index) => <div className="merchant-hour" key={h.day}>
      <label><input type="checkbox" checked={h.enabled} onChange={e => setHours(all => all.map((x, i) => i === index ? { ...x, enabled: e.target.checked } : x))} />{DAYS[index]}</label>
      <input type="time" aria-label={`Mở cửa ${DAYS[index]}`} value={h.open} disabled={!h.enabled} onChange={e => setHours(all => all.map((x, i) => i === index ? { ...x, open: e.target.value } : x))} />
      <input type="time" aria-label={`Đóng cửa ${DAYS[index]}`} value={h.close} disabled={!h.enabled} onChange={e => setHours(all => all.map((x, i) => i === index ? { ...x, close: e.target.value } : x))} />
    </div>)}
    <Button variant="secondary" disabled={hours.some(h => h.enabled && h.open >= h.close)} onClick={() => save(hours.filter(h => h.enabled).map(({ day, open, close }) => ({ day, open, close })))}>Lưu giờ mở cửa</Button>
  </div>;
}

export function MerchantPage() {
  const client = useQueryClient();
  const [selected, setSelected] = useState('');
  const [newPlace, setNewPlace] = useState({ name: '', address: '', longitude: '', latitude: '', contactPhone: '', evidence: '' });
  const [claim, setClaim] = useState({ placeId: '', businessName: '', contactPhone: '', evidence: '' });
  const [change, setChange] = useState({ name: '', description: '', address: '' });
  const [image, setImage] = useState<File | null>(null);
  const [bookingReasons, setBookingReasons] = useState<Record<string, string>>({});
  const [code, setCode] = useState('');
  const [expires, setExpires] = useState(0);
  const [notice, setNotice] = useState('');
  const places = useQuery({ queryKey: ['merchant-places'], queryFn: () => api.request<{ items: Place[] }>('/api/merchant/places') });
  const claims = useQuery({ queryKey: ['merchant-claims'], queryFn: () => api.request<{ items: Claim[] }>('/api/merchant/claims/me') });
  const current = places.data?.items.find(p => p._id === selected) || places.data?.items[0];
  const bookings = useQuery({ queryKey: ['merchant-bookings', current?._id], enabled: !!current,
    queryFn: () => api.request<{ items: Booking[] }>(`/api/merchant/places/${enc(current!._id)}/bookings`, { query: { page: 1, limit: 100 } }) });
  const mutation = useMutation({ mutationFn: ({ path, body, method = 'POST' }: { path: string; body?: unknown; method?: 'POST' | 'PATCH' }) =>
    api.request<{ code?: string; expiresInSeconds?: number }>(path, { method, body }),
    onSuccess: async result => {
      if (result.code) { setCode(result.code); setExpires(Date.now() + (result.expiresInSeconds || 90) * 1000); }
      setNotice('Đã gửi thành công.');
      await Promise.all(['merchant-places', 'merchant-claims', 'merchant-bookings'].map(queryKey => client.invalidateQueries({ queryKey: [queryKey] })));
    } });
  const upload = useMutation({ mutationFn: () => {
    if (!current || !image) throw new Error('Chọn ảnh trước khi tải lên');
    const body = new FormData(); body.append('image', image);
    return api.request(`/api/merchant/places/${enc(current._id)}/images`, { method: 'POST', body });
  }, onSuccess: () => { setImage(null); setNotice('Ảnh đã gửi, chờ admin duyệt.'); } });
  useEffect(() => { if (!code) return; const timer = setInterval(() => { if (Date.now() >= expires) setCode(''); }, 1000); return () => clearInterval(timer); }, [code, expires]);
  const send = (path: string, body?: unknown, method?: 'POST' | 'PATCH') => { setNotice(''); mutation.mutate({ path, body, method }); };
  const evidenceUrls = (text: string) => text.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  if (places.isPending) return <LoadingRows />;
  if (places.isError) return <StateMessage tone="error" heading="Không tải được quán" sentence={errorMessage(places.error)} action={{ label: 'Thử lại', onClick: () => void places.refetch() }} />;
  return <>
    <PageHeader title="Quán của tôi" />
    <div className="section"><FormAlert message={mutation.isError ? errorMessage(mutation.error) : notice} /></div>
    <section className="section merchant-grid">
      <div className="merchant-card"><h2>Đưa quán mới lên StudySpot</h2><p>Hồ sơ được admin duyệt trước khi quán xuất hiện trên bản đồ.</p>
        <TextField label="Tên quán" value={newPlace.name} onChange={e => setNewPlace({ ...newPlace, name: e.target.value })} />
        <TextField label="Địa chỉ" value={newPlace.address} onChange={e => setNewPlace({ ...newPlace, address: e.target.value })} />
        <TextField label="Kinh độ" type="number" value={newPlace.longitude} onChange={e => setNewPlace({ ...newPlace, longitude: e.target.value })} />
        <TextField label="Vĩ độ" type="number" value={newPlace.latitude} onChange={e => setNewPlace({ ...newPlace, latitude: e.target.value })} />
        <TextField label="Điện thoại quán" value={newPlace.contactPhone} onChange={e => setNewPlace({ ...newPlace, contactPhone: e.target.value })} />
        <TextArea label="Link minh chứng HTTPS (mỗi dòng một link)" value={newPlace.evidence} onChange={e => setNewPlace({ ...newPlace, evidence: e.target.value })} />
        <Button disabled={!newPlace.name || !newPlace.address || !newPlace.contactPhone || !newPlace.evidence ||
          !newPlace.longitude || !newPlace.latitude || !Number.isFinite(Number(newPlace.longitude)) || !Number.isFinite(Number(newPlace.latitude))}
          busy={mutation.isPending} onClick={() => send('/api/merchant/places', { name: newPlace.name, address: newPlace.address,
            coordinates: [Number(newPlace.longitude), Number(newPlace.latitude)], contactPhone: newPlace.contactPhone,
            evidenceUrls: evidenceUrls(newPlace.evidence) })}>Gửi hồ sơ quán</Button>
      </div>
      <div className="merchant-card"><h2>Nhận quyền quản lý quán đã có</h2><p>Chỉ áp dụng khi quán chưa có chủ sở hữu.</p>
        <TextField label="Mã địa điểm" value={claim.placeId} onChange={e => setClaim({ ...claim, placeId: e.target.value })} />
        <TextField label="Tên kinh doanh" value={claim.businessName} onChange={e => setClaim({ ...claim, businessName: e.target.value })} />
        <TextField label="Số điện thoại" value={claim.contactPhone} onChange={e => setClaim({ ...claim, contactPhone: e.target.value })} />
        <TextArea label="Link minh chứng HTTPS" value={claim.evidence} onChange={e => setClaim({ ...claim, evidence: e.target.value })} />
        <Button busy={mutation.isPending} disabled={!claim.placeId || !claim.businessName || !claim.evidence} onClick={() =>
          send('/api/merchant/claims', { placeId: claim.placeId, businessName: claim.businessName,
            contactPhone: claim.contactPhone, evidenceUrls: evidenceUrls(claim.evidence) })}>Gửi yêu cầu</Button>
        <h3>Hồ sơ đã gửi</h3>{claims.data?.items.map(c => <p key={c._id}>{c.place?.name || c._id}: {c.status} {c.decisionNote || ''}</p>)}
      </div>
    </section>
    {places.data?.items.length ? <section className="section merchant-card">
      <Select label="Chọn quán" value={current?._id || ''} onChange={e => { setSelected(e.target.value); setCode(''); }}
        options={places.data.items.map(p => ({ value: p._id, label: `${p.name} (${p.approval})` }))} />
      {current ? <><h2>{current.name}</h2><p>{current.address} · {current.approval}</p>
        {current.approval === 'approved' ? <>
          <div className="merchant-grid">
            <div><h3>Vận hành & đặt chỗ</h3>
              <label><input type="checkbox" checked={!!current.business?.temporaryClosed} onChange={e => send(`/api/merchant/places/${enc(current._id)}`, { temporaryClosed: e.target.checked }, 'PATCH')} /> Tạm đóng cửa</label>
              <label><input type="checkbox" checked={!!current.booking?.enabled} onChange={e => send(`/api/merchant/places/${enc(current._id)}`, { bookingEnabled: e.target.checked }, 'PATCH')} /> Nhận đặt chỗ</label>
              <Select label="Duyệt booking" value={current.booking?.approvalMode || 'auto'} options={[{ value: 'auto', label: 'Tự động' }, { value: 'manual', label: 'Chủ quán xác nhận' }]}
                onChange={e => send(`/api/merchant/places/${enc(current._id)}`, { approvalMode: e.target.value }, 'PATCH')} />
              <TextField label="Số chỗ mỗi khung giờ" type="number" min="1" defaultValue={current.booking?.capacityPerSlot || ''}
                onBlur={e => { const value = Number(e.target.value); if (value > 0 && value !== current.booking?.capacityPerSlot)
                  send(`/api/merchant/places/${enc(current._id)}`, { capacityPerSlot: value }, 'PATCH'); }} />
              <TextField label="Số ghế tại quán" type="number" min="1" defaultValue={current.business?.seatingCapacity || ''}
                onBlur={e => { const value = Number(e.target.value); if (value > 0 && value !== current.business?.seatingCapacity)
                  send(`/api/merchant/places/${enc(current._id)}`, { seatingCapacity: value }, 'PATCH'); }} />
              <TextField label="Giá nước thấp nhất (VND)" type="number" min="0" defaultValue={current.minDrinkPrice ?? ''}
                onBlur={e => { const value = Number(e.target.value); if (e.target.value !== '' && value >= 0 && value !== current.minDrinkPrice)
                  send(`/api/merchant/places/${enc(current._id)}`, { minDrinkPrice: value }, 'PATCH'); }} />
              <TextField label="Điện thoại liên hệ" defaultValue={current.business?.phone || ''}
                onBlur={e => { const value = e.target.value.trim(); if (value.length >= 8 && value !== current.business?.phone)
                  send(`/api/merchant/places/${enc(current._id)}`, { phone: value }, 'PATCH'); }} />
              <Select label="Wi-Fi" value={String(current.amenities?.wifi ?? 'unknown')} options={[
                { value: 'unknown', label: 'Chưa rõ' }, { value: 'true', label: 'Có' }, { value: 'false', label: 'Không' }]}
                onChange={e => send(`/api/merchant/places/${enc(current._id)}`, { wifi: e.target.value === 'unknown' ? null : e.target.value === 'true' }, 'PATCH')} />
              <Select label="Ổ cắm" value={String(current.amenities?.outlets ?? 'unknown')} options={[
                { value: 'unknown', label: 'Chưa rõ' }, { value: 'true', label: 'Có' }, { value: 'false', label: 'Không' }]}
                onChange={e => send(`/api/merchant/places/${enc(current._id)}`, { outlets: e.target.value === 'unknown' ? null : e.target.value === 'true' }, 'PATCH')} />
              <Select label="Độ dài khung giờ" value={String(current.booking?.slotMinutes || 60)}
                options={[30, 60, 120].map(n => ({ value: String(n), label: `${n} phút` }))}
                onChange={e => send(`/api/merchant/places/${enc(current._id)}`, { slotMinutes: Number(e.target.value) }, 'PATCH')} />
            </div>
            <div><h3>Xác minh khách đã vào quán</h3><p>Mã QR tự hết hạn sau 90 giây. Khách quét mã tại quầy; đánh giá được xác minh khi có chứng cứ ghé thăm.</p>
              <Button onClick={() => send(`/api/merchant/places/${enc(current._id)}/visit-code`)}>Tạo mã QR</Button>
              {code ? <div className="merchant-qr"><QRCodeSVG value={code} size={220} /><span>Hết hạn lúc {new Date(expires).toLocaleTimeString('vi-VN')}</span></div> : null}</div>
          </div>
          <OpeningHours key={current._id} place={current} save={openingHours => send(`/api/merchant/places/${enc(current._id)}`, { openingHours }, 'PATCH')} />
          <h3>Đề nghị sửa thông tin công khai</h3><div className="merchant-grid">
            <TextField label="Tên mới" value={change.name} onChange={e => setChange({ ...change, name: e.target.value })} />
            <TextField label="Địa chỉ mới" value={change.address} onChange={e => setChange({ ...change, address: e.target.value })} />
            <TextArea label="Mô tả mới" value={change.description} onChange={e => setChange({ ...change, description: e.target.value })} />
          </div><Button disabled={!change.name && !change.address && !change.description} onClick={() => send(`/api/merchant/places/${enc(current._id)}/change-requests`,
            Object.fromEntries(Object.entries(change).filter(([, value]) => value.trim())))}>Gửi thay đổi để duyệt</Button>
          <h3>Gửi ảnh quán để duyệt</h3>
          <input type="file" aria-label="Chọn ảnh quán" accept="image/jpeg,image/png,image/webp" onChange={e => setImage(e.target.files?.[0] || null)} />
          <Button variant="secondary" disabled={!image} busy={upload.isPending} onClick={() => upload.mutate()}>Tải ảnh lên</Button>
          <FormAlert message={upload.isError ? errorMessage(upload.error) : null} />
          <h3>Booking của quán</h3>{bookings.isPending ? <LoadingRows rows={2} /> : bookings.isError ? <FormAlert message={errorMessage(bookings.error)} /> :
            bookings.data?.items.length ? <ul className="rows">{bookings.data.items.map(b => <li className="row" key={b._id}>
              <div className="row__main"><strong>{b.user?.name || b.user?.email}</strong><span>{new Date(b.startsAt).toLocaleString('vi-VN')} · {b.partySize} khách · {b.status}</span>{b.note ? <p>{b.note}</p> : null}
                {['pending', 'confirmed'].includes(b.status) ? <TextField label="Lý do nếu từ chối hoặc hủy" value={bookingReasons[b._id] || ''}
                  onChange={e => setBookingReasons(all => ({ ...all, [b._id]: e.target.value }))} /> : null}</div>
              <div className="row__actions">{(b.status === 'pending' ? ['approve', 'reject'] : b.status === 'confirmed' ? ['arrived', 'cancel', 'no_show'] : []).map(action =>
                <Button size="small" variant={action === 'reject' || action === 'cancel' ? 'danger' : 'secondary'} key={action}
                  disabled={['reject', 'cancel'].includes(action) && (bookingReasons[b._id] || '').trim().length < 5}
                  onClick={() => send(`/api/bookings/${enc(b._id)}/merchant-decision`, { action,
                    ...(['reject', 'cancel'].includes(action) ? { reason: bookingReasons[b._id].trim() } : {}) }, 'PATCH')}>
                    {({ approve: 'Duyệt', reject: 'Từ chối', arrived: 'Đã đến', cancel: 'Hủy', no_show: 'Không đến' } as Record<string, string>)[action]}
                  </Button>)}</div>
            </li>)}</ul> : <p>Chưa có booking.</p>}
        </> : <p>Đang chờ admin duyệt quán.</p>}</> : null}
    </section> : null}
  </>;
}
