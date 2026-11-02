import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useNavigate, useSearchParams } from 'react-router';

import { errorMessage } from '../api/errors';
import { usePlaces, useUpdatePlace, useUploadImage } from '../api/hooks';
import { PAGE_SIZE } from '../api/endpoints';
import type { Approval, Place } from '../api/types';
import { PlaceForm } from '../components/PlaceForm';
import { Button, FilterTabs, FormAlert, LoadingRows, PageHeader, Pagination, Select, StateMessage, Tag, TextField } from '../components/ui';
import { amenityText, formatDateTime, formatRating, priceText } from '../utils/format';
import { APPROVAL_LABELS } from '../utils/labels';
import { placeChanges } from '../utils/placeDiff';

type Filter = Approval | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'all', label: 'Tất cả' },
];

const EMPTY_TEXT: Record<Filter, { heading: string; sentence: string }> = {
  pending: { heading: 'Không có địa điểm chờ duyệt', sentence: 'Đề xuất mới của sinh viên sẽ hiện ở đây.' },
  approved: { heading: 'Chưa có địa điểm nào được duyệt', sentence: 'Duyệt đề xuất hoặc thêm địa điểm mới.' },
  rejected: { heading: 'Không có địa điểm bị từ chối', sentence: 'Địa điểm bị từ chối sẽ hiện ở đây.' },
  all: { heading: 'Chưa có địa điểm nào', sentence: 'Thêm địa điểm đầu tiên để sinh viên tìm thấy.' },
};

function approvalTone(approval: Approval | undefined): 'ink' | 'muted' | 'error' {
  if (approval === 'pending') return 'ink';
  if (approval === 'rejected') return 'error';
  return 'muted';
}

function readFilter(value: string | null): Filter {
  return FILTERS.some((f) => f.value === value) ? (value as Filter) : 'pending';
}

function ImageUploader({ place }: { place: Place }) {
  const upload = useUploadImage();
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const images = upload.data?.place?.images ?? place.images ?? [];

  return (
    <div className="form-grid__wide">
      <span className="field__label">Ảnh ({images.length})</span>
      {images.length ? (
        <div className="images">
          {images.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt={`Ảnh của ${place.name ?? 'địa điểm'}`} loading="lazy" />
            </a>
          ))}
        </div>
      ) : (
        <p className="field__hint">Chưa có ảnh.</p>
      )}
      <div className="form-actions">
        <label className={`btn btn--secondary btn--small file-pick${upload.isPending ? ' file-pick--disabled' : ''}`}>
          <input
            key={inputKey}
            type="file"
            className="visually-hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              upload.reset();
            }}
            disabled={upload.isPending}
          />
          <span>Chọn ảnh</span>
        </label>
        <span className="field__hint">{file ? file.name : 'Chưa chọn tệp'}</span>
        <Button
          variant="secondary"
          size="small"
          disabled={!file}
          busy={upload.isPending}
          busyLabel="Đang tải ảnh"
          onClick={() => {
            if (!file || !place._id) return;
            upload.mutate(
              { id: place._id, file },
              {
                onSuccess: () => {
                  setFile(null);
                  setInputKey((key) => key + 1);
                },
              },
            );
          }}>
          Tải ảnh lên
        </Button>
        {upload.isSuccess ? <span className="field__hint">Đã tải ảnh lên.</span> : null}
        <FormAlert message={upload.isError ? errorMessage(upload.error) : null} />
      </div>
      <p className="field__hint">JPEG, PNG hoặc WebP, tối đa 5 MB. Cần cấu hình Cloudinary trên máy chủ.</p>
    </div>
  );
}

function PlaceEditor({ place, onDone }: { place: Place; onDone: () => void }) {
  const update = useUpdatePlace();
  const [approval, setApproval] = useState<Approval>(place.approval ?? 'pending');
  const [localError, setLocalError] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [ownerId, setOwnerId] = useState(place.owner || '');
  const [reason, setReason] = useState('');
  const client = useQueryClient();
  const transfer = useMutation({ mutationFn: () => api.request(`/api/admin/places/${encodeURIComponent(place._id || '')}/owner`,
    { method: 'PATCH', body: { ownerId: ownerId.trim() || null, reason: reason.trim() } }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin', 'places'] }); onDone(); } });

  return (
    <div className="row__editor">
      <PlaceForm
        place={place}
        submitLabel="Lưu thay đổi"
        busy={update.isPending}
        error={localError ?? (update.isError ? errorMessage(update.error) : null)}
        onCancel={onDone}
        onEdit={() => {
          setLocalError(null);
          if (update.isError) update.reset();
        }}
        onSubmit={(input) => {
          const changes = placeChanges(place, input, approval);
          if (approval !== place.approval) {
            if (decisionNote.trim().length < 5) { setLocalError('Ghi lý do duyệt ít nhất 5 ký tự.'); return; }
            changes.decisionNote = decisionNote.trim();
          }
          if (!Object.keys(changes).length) {
            setLocalError('Chưa có thay đổi nào để lưu.');
            return;
          }
          setLocalError(null);
          update.mutate({ id: place._id as string, changes }, { onSuccess: onDone });
        }}>
        <Select
          label="Trạng thái duyệt"
          value={approval}
          onChange={(event) => {
            setApproval(event.target.value as Approval);
            setLocalError(null);
          }}
          options={(Object.keys(APPROVAL_LABELS) as Approval[]).map((value) => ({ value, label: APPROVAL_LABELS[value] }))}
        />
        <TextField label="Lý do quyết định (khi đổi trạng thái duyệt)" value={decisionNote} onChange={e => setDecisionNote(e.target.value)} />
        <ImageUploader place={place} />
      </PlaceForm>
      <div className="section">
        <h3>Chủ quán & minh chứng</h3>
        {place.onboardingEvidenceUrls?.map(url => <p key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></p>)}
        <TextField label="ID chủ quán (để trống nếu chưa có)" value={ownerId} onChange={e => setOwnerId(e.target.value)} />
        <TextField label="Lý do chuyển quyền" value={reason} onChange={e => setReason(e.target.value)} />
        <Button variant="secondary" disabled={reason.trim().length < 5} busy={transfer.isPending} onClick={() => transfer.mutate()}>Chuyển quyền quản lý</Button>
        <FormAlert message={transfer.isError ? errorMessage(transfer.error) : null} />
      </div>
    </div>
  );
}

function PlaceRowItem({ place, open, onToggle }: { place: Place; open: boolean; onToggle: () => void }) {
  const update = useUpdatePlace();
  const id = place._id as string;
  const [lng, lat] = place.location?.coordinates ?? [];
  const [decisionNote, setDecisionNote] = useState('');

  function setApproval(approval: Approval) {
    if (decisionNote.trim().length < 5) return;
    update.mutate({ id, changes: { approval, decisionNote: decisionNote.trim() } });
  }

  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {place.name}
          <Tag tone={approvalTone(place.approval)}>{APPROVAL_LABELS[place.approval ?? 'pending']}</Tag>
        </span>
        <span className="row__secondary">{place.address}</span>
        {place.description ? <p className="row__body">{place.description}</p> : null}
        <span className="row__meta">
          <span>Wi-Fi: {amenityText(place.amenities?.wifi)}</span>
          <span>Ổ cắm: {amenityText(place.amenities?.outlets)}</span>
          <span>Giá nước từ: {priceText(place.minDrinkPrice)}</span>
          <span>
            {place.ratingCount ? `${formatRating(place.ratingAverage ?? 0)} (${place.ratingCount} đánh giá)` : 'Chưa có đánh giá'}
          </span>
          {typeof lat === 'number' && typeof lng === 'number' ? (
            <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`} target="_blank" rel="noreferrer">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </a>
          ) : null}
          <span>Tạo lúc {formatDateTime(place.createdAt)}</span>
        </span>
        <span className="row__secondary">{place.moderationNote ? `Lý do duyệt: ${place.moderationNote}` : null}</span>
        <TextField label="Lý do duyệt / từ chối" value={decisionNote} onChange={e => setDecisionNote(e.target.value)} />
      </div>
      <div className="row__actions">
        {place.approval !== 'approved' ? (
          <Button size="small" busy={update.isPending && update.variables?.changes.approval === 'approved'} disabled={update.isPending || decisionNote.trim().length < 5} onClick={() => setApproval('approved')}>
            Duyệt
          </Button>
        ) : null}
        {place.approval !== 'rejected' ? (
          <Button
            variant="danger"
            size="small"
            busy={update.isPending && update.variables?.changes.approval === 'rejected'}
            disabled={update.isPending || decisionNote.trim().length < 5}
            onClick={() => setApproval('rejected')}>
            Từ chối
          </Button>
        ) : null}
        <Button variant="secondary" size="small" aria-expanded={open} onClick={onToggle}>
          {open ? 'Đóng' : 'Sửa'}
        </Button>
      </div>
      {update.isError ? (
        <div className="row__error">
          <FormAlert message={errorMessage(update.error)} />
        </div>
      ) : null}
      {open ? <PlaceEditor place={place} onDone={onToggle} /> : null}
    </li>
  );
}

export function PlacesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = readFilter(params.get('approval'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const places = usePlaces(filter, page);
  const [openId, setOpenId] = useState<string | null>(null);

  function go(next: { approval?: Filter; page?: number }) {
    const search = new URLSearchParams();
    search.set('approval', next.approval ?? filter);
    const nextPage = next.page ?? 1;
    if (nextPage > 1) search.set('page', String(nextPage));
    setParams(search);
    setOpenId(null);
  }

  const items = places.data?.items ?? [];
  const total = places.data?.total ?? 0;

  let body;
  if (places.isPending) {
    body = <LoadingRows />;
  } else if (places.isError && !places.data) {
    body = (
      <StateMessage
        tone="error"
        heading="Chưa tải được địa điểm"
        sentence={errorMessage(places.error)}
        action={{ label: 'Thử lại', onClick: () => void places.refetch(), busy: places.isFetching }}
      />
    );
  } else if (!items.length) {
    body = <StateMessage {...EMPTY_TEXT[filter]} action={{ label: 'Thêm địa điểm', variant: 'primary', onClick: () => navigate('/places/new') }} />;
  } else {
    body = (
      <>
        <ul className="rows" aria-busy={places.isFetching || undefined}>
          {items.map((place) => (
            <PlaceRowItem
              key={place._id}
              place={place}
              open={openId === place._id}
              onToggle={() => setOpenId((current) => (current === place._id ? null : (place._id ?? null)))}
            />
          ))}
        </ul>
        <Pagination page={page} limit={places.data?.limit ?? PAGE_SIZE} total={total} onChange={(next) => go({ page: next })} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Địa điểm"
        right={
          <>
            {places.data ? <span>{total} địa điểm</span> : null}
            <Button onClick={() => navigate('/places/new')}>Thêm địa điểm</Button>
          </>
        }
      />
      <FilterTabs label="Lọc theo trạng thái duyệt" value={filter} options={FILTERS} onChange={(value) => go({ approval: value })} />
      {body}
    </>
  );
}
