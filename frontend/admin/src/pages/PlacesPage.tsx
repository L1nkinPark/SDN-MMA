import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { PAGE_SIZE } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { useAdminUsers, usePlaces, useTransferOwner, useUpdatePlace, useUploadImage } from '../api/hooks';
import type { Approval, Place } from '../api/types';
import { useSession } from '../auth/sessionContext';
import { PlaceForm } from '../components/PlaceForm';
import { Button, FilterTabs, FormAlert, LoadingRows, PageHeader, Pagination, Select, StateMessage, Tag, TextField } from '../components/ui';
import { amenityText, formatDateTime, formatRating, priceText } from '../utils/format';
import { APPROVAL_LABELS, USER_ROLE_LABELS } from '../utils/labels';
import { hasPermission } from '../utils/permissions';
import { placeChanges } from '../utils/placeDiff';
import { reasonError } from '../utils/validation';

type Filter = Approval | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'all', label: 'Tất cả' },
];

const EMPTY_TEXT: Record<Filter, { heading: string; sentence: string }> = {
  pending: { heading: 'Không có địa điểm chờ duyệt', sentence: 'Đề xuất của sinh viên và hồ sơ quán mới của chủ quán sẽ hiện ở đây.' },
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

type OwnerChoice = { id: string | null; label: string };

/** Evidence from the merchant's application and the owner, with a transfer found by email (needs the users permission). */
function OwnerSection({ place, onDone }: { place: Place; onDone: () => void }) {
  const { user } = useSession();
  const canSearch = hasPermission(user, 'users');
  const transfer = useTransferOwner();
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [chosen, setChosen] = useState<OwnerChoice | null>(null);
  const [reason, setReason] = useState('');
  const [reasonFieldError, setReasonFieldError] = useState<string | null>(null);
  const users = useAdminUsers({ page: 1, q: term || undefined, status: 'active' }, canSearch && term.length >= 3);
  const evidence = place.onboardingEvidenceUrls ?? [];
  const candidates = (users.data?.items ?? []).filter((item) => item.role !== 'admin');

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  function submit() {
    const error = reasonError(reason, true);
    setReasonFieldError(error);
    if (error || !chosen || !place._id) return;
    transfer.mutate({ id: place._id, ownerId: chosen.id, reason: reason.trim() }, { onSuccess: onDone });
  }

  return (
    <div className="form-grid__wide owner">
      <span className="field__label">Chủ quán và minh chứng</span>
      <p className="row__secondary">{place.owner ? 'Địa điểm đang có chủ quán quản lý.' : 'Địa điểm chưa có chủ quán.'}</p>
      {evidence.length ? (
        <ul className="link-list">
          {evidence.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer noopener">
                {url}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {!canSearch ? (
        <p className="field__hint">Cần quyền Người dùng để tìm tài khoản và chuyển quyền quản lý.</p>
      ) : (
        <>
          <TextField
            label="Chuyển quyền quản lý: tìm tài khoản theo email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            hint="Gõ ít nhất 3 ký tự. Sinh viên được chọn sẽ thành chủ quán; các đề nghị sửa đang chờ bị từ chối."
            disabled={transfer.isPending}
          />
          {term.length >= 3 && candidates.length ? (
            <ul className="link-list">
              {candidates.map((item) => (
                <li key={item._id}>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => setChosen({ id: item._id, label: `${item.name} (${item.email}, ${USER_ROLE_LABELS[item.role]})` })}>
                    {item.name} · {item.email}
                  </Button>
                </li>
              ))}
            </ul>
          ) : term.length >= 3 && users.isSuccess ? (
            <p className="field__hint">Không thấy tài khoản đang hoạt động phù hợp.</p>
          ) : null}
          {place.owner && !chosen ? (
            <Button variant="text" size="small" onClick={() => setChosen({ id: null, label: 'Gỡ chủ hiện tại, quán không còn chủ' })}>
              Gỡ chủ quán
            </Button>
          ) : null}
          {chosen ? (
            <>
              <p className="row__body">Chuyển cho: {chosen.label}</p>
              <TextField
                label="Lý do chuyển quyền (bắt buộc, ít nhất 5 ký tự)"
                value={reason}
                maxLength={500}
                onChange={(event) => {
                  setReason(event.target.value);
                  setReasonFieldError(null);
                }}
                error={reasonFieldError}
                disabled={transfer.isPending}
              />
              <div className="form-actions">
                <Button variant="secondary" size="small" busy={transfer.isPending} onClick={submit}>
                  Xác nhận chuyển quyền
                </Button>
                <Button variant="text" size="small" onClick={() => setChosen(null)} disabled={transfer.isPending}>
                  Hủy
                </Button>
              </div>
            </>
          ) : null}
          <FormAlert message={transfer.isError ? errorMessage(transfer.error) : null} />
        </>
      )}
    </div>
  );
}

function PlaceEditor({ place, onDone }: { place: Place; onDone: () => void }) {
  const update = useUpdatePlace();
  const [approval, setApproval] = useState<Approval>(place.approval ?? 'pending');
  const [localError, setLocalError] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState('');

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
          const noteError = reasonError(decisionNote, false);
          if (noteError) {
            setLocalError(noteError);
            return;
          }
          if (!Object.keys(changes).length) {
            setLocalError('Chưa có thay đổi nào để lưu.');
            return;
          }
          if (decisionNote.trim()) changes.decisionNote = decisionNote.trim();
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
        <TextField
          label="Ghi chú quyết định (không bắt buộc, gửi người đề xuất)"
          value={decisionNote}
          maxLength={1000}
          onChange={(event) => setDecisionNote(event.target.value)}
          disabled={update.isPending}
        />
        <ImageUploader place={place} />
        <OwnerSection place={place} onDone={onDone} />
      </PlaceForm>
    </div>
  );
}

function PlaceRowItem({ place, open, onToggle }: { place: Place; open: boolean; onToggle: () => void }) {
  const update = useUpdatePlace();
  const id = place._id as string;
  const [lng, lat] = place.location?.coordinates ?? [];
  const [decisionNote, setDecisionNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const evidenceCount = place.onboardingEvidenceUrls?.length ?? 0;

  function setApproval(approval: Approval) {
    const error = reasonError(decisionNote, false);
    setNoteError(error);
    if (error) return;
    update.mutate({ id, changes: { approval, ...(decisionNote.trim() ? { decisionNote: decisionNote.trim() } : {}) } });
  }

  return (
    <li className="row">
      <div className="row__main">
        <span className="row__title">
          {place.name}
          <Tag tone={approvalTone(place.approval)}>{APPROVAL_LABELS[place.approval ?? 'pending']}</Tag>
          {place.owner ? <Tag>Có chủ quán</Tag> : null}
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
        {evidenceCount ? <span className="row__secondary">Hồ sơ chủ quán kèm {evidenceCount} link minh chứng (bấm Sửa để xem).</span> : null}
        {place.moderationNote ? <p className="row__body">Ghi chú quyết định: {place.moderationNote}</p> : null}
        <TextField
          label="Ghi chú gửi người đề xuất khi duyệt hoặc từ chối (không bắt buộc)"
          value={decisionNote}
          maxLength={1000}
          onChange={(event) => {
            setDecisionNote(event.target.value);
            setNoteError(null);
          }}
          error={noteError}
          disabled={update.isPending}
        />
      </div>
      <div className="row__actions">
        {place.approval !== 'approved' ? (
          <Button
            size="small"
            busy={update.isPending && update.variables?.changes.approval === 'approved'}
            disabled={update.isPending}
            onClick={() => setApproval('approved')}>
            Duyệt
          </Button>
        ) : null}
        {place.approval !== 'rejected' ? (
          <Button
            variant="danger"
            size="small"
            busy={update.isPending && update.variables?.changes.approval === 'rejected'}
            disabled={update.isPending}
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
