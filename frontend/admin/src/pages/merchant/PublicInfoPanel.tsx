import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { errorMessage } from '../../api/errors';
import { useSubmitChange, useSubmitImage } from '../../api/hooks';
import type { Place, PlaceChangeFields } from '../../api/types';
import { Button, FormAlert, TextArea, TextField } from '../../components/ui';
import { addressError, descriptionError, latitudeError, longitudeError, parseDecimal, placeNameError } from '../../utils/validation';

type Values = { name: string; address: string; description: string; latitude: string; longitude: string };
type Errors = Partial<Record<keyof Values, string | null>>;

function initial(place: Place): Values {
  const [lng, lat] = place.location?.coordinates ?? [];
  return {
    name: place.name ?? '',
    address: place.address ?? '',
    description: place.description ?? '',
    latitude: typeof lat === 'number' ? String(lat) : '',
    longitude: typeof lng === 'number' ? String(lng) : '',
  };
}

/** Name, address, description and position go through an admin; so do photos. */
export function PublicInfoPanel({ place }: { place: Place }) {
  const change = useSubmitChange();
  const image = useSubmitImage();
  const [values, setValues] = useState<Values>(() => initial(place));
  const [errors, setErrors] = useState<Errors>({});
  const [file, setFile] = useState<File | null>(null);
  const before = initial(place);

  function set(key: keyof Values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: null }));
    if (change.isError || change.isSuccess) change.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!place._id || change.isPending) return;
    const changes: PlaceChangeFields = {};
    const found: Errors = {};
    if (values.name.trim() !== before.name) {
      found.name = placeNameError(values.name);
      changes.name = values.name.trim();
    }
    if (values.address.trim() !== before.address) {
      found.address = addressError(values.address);
      changes.address = values.address.trim();
    }
    if (values.description.trim() !== before.description) {
      found.description = descriptionError(values.description);
      changes.description = values.description.trim();
    }
    if (values.latitude.trim() !== before.latitude || values.longitude.trim() !== before.longitude) {
      found.latitude = latitudeError(values.latitude);
      found.longitude = longitudeError(values.longitude);
      // The API takes [longitude, latitude].
      changes.coordinates = [parseDecimal(values.longitude) as number, parseDecimal(values.latitude) as number];
    }
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    if (Object.keys(changes).length === 0) {
      setErrors({ name: 'Chưa có thay đổi nào. Sửa ít nhất một thông tin rồi gửi.' });
      return;
    }
    change.mutate({ id: place._id, changes });
  }

  return (
    <div className="section settings">
      <h2 className="settings__title">Đề nghị sửa thông tin công khai</h2>
      <p className="state__sentence">
        Tên, địa chỉ, mô tả và vị trí được quản trị viên duyệt trước khi hiện trong app. Mỗi quán chỉ có một đề nghị chờ duyệt tại một thời điểm.
      </p>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextField label="Tên quán" value={values.name} maxLength={120} onChange={(e) => set('name', e.target.value)} error={errors.name} disabled={change.isPending} />
          <TextField label="Địa chỉ" value={values.address} maxLength={300} onChange={(e) => set('address', e.target.value)} error={errors.address} disabled={change.isPending} />
          <TextField label="Vĩ độ (latitude)" inputMode="decimal" value={values.latitude} onChange={(e) => set('latitude', e.target.value)} error={errors.latitude} disabled={change.isPending} />
          <TextField label="Kinh độ (longitude)" inputMode="decimal" value={values.longitude} onChange={(e) => set('longitude', e.target.value)} error={errors.longitude} disabled={change.isPending} />
          <div className="form-grid__wide">
            <TextArea label="Mô tả" value={values.description} maxLength={2000} onChange={(e) => set('description', e.target.value)} error={errors.description} disabled={change.isPending} />
          </div>
          <div className="form-grid__wide form-actions">
            <Button type="submit" busy={change.isPending} busyLabel="Đang gửi">
              Gửi đề nghị
            </Button>
            <FormAlert message={change.isError ? errorMessage(change.error) : null} />
            {change.isSuccess ? (
              <p className="notice" role="status">
                Đã gửi đề nghị, đang chờ quản trị viên duyệt.
              </p>
            ) : null}
          </div>
        </div>
      </form>

      <h2 className="settings__title">Gửi ảnh quán</h2>
      <p className="state__sentence">Ảnh JPEG, PNG hoặc WebP, tối đa 5 MB. Ảnh hiện trong app sau khi được duyệt.</p>
      {place.images?.length ? (
        <div className="images">
          {place.images.map((url) => (
            <img key={url} src={url} alt={`Ảnh ${place.name ?? 'quán'}`} />
          ))}
        </div>
      ) : null}
      <div className="form-actions">
        <label className={`btn btn--secondary btn--small file-pick${image.isPending ? ' file-pick--disabled' : ''}`}>
          {file ? file.name : 'Chọn ảnh'}
          <input
            type="file"
            className="visually-hidden"
            accept="image/jpeg,image/png,image/webp"
            disabled={image.isPending}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              image.reset();
            }}
          />
        </label>
        <Button
          size="small"
          disabled={!file}
          busy={image.isPending}
          busyLabel="Đang tải lên"
          onClick={() => file && place._id && image.mutate({ id: place._id, file }, { onSuccess: () => setFile(null) })}>
          Gửi ảnh để duyệt
        </Button>
        <FormAlert message={image.isError ? errorMessage(image.error) : null} />
        {image.isSuccess ? (
          <p className="notice" role="status">
            Đã gửi ảnh, đang chờ quản trị viên duyệt.
          </p>
        ) : null}
      </div>
      <p className="field__hint">
        Xem kết quả ở <Link to="/merchant/requests">Đề nghị đã gửi</Link>.
      </p>
    </div>
  );
}
