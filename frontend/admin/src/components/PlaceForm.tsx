import { useState, type FormEvent, type ReactNode } from 'react';

import type { Place, PlaceInput } from '../api/types';
import { AMENITY_OPTIONS, EMPTY_ERRORS, initialValues, toPlaceInput, validate, type Field, type Values } from '../utils/placeForm';
import { Button, ChoiceGroup, FormAlert, TextArea, TextField } from './ui';
import { LocationPicker } from './LocationPicker';

type PlaceFormProps = {
  place?: Place;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (input: PlaceInput) => void;
  onCancel?: () => void;
  /** Called on every edit, e.g. to clear a stale error. */
  onEdit?: () => void;
  /** Extra fields, e.g. the approval select when editing. */
  children?: ReactNode;
};

/** Shared by "Thêm địa điểm" and the inline editor. */
export function PlaceForm({ place, submitLabel, busy, error, onSubmit, onCancel, onEdit, children }: PlaceFormProps) {
  const [values, setValues] = useState<Values>(() => initialValues(place));
  const [errors, setErrors] = useState<Record<Field, string | null>>(EMPTY_ERRORS);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: null }));
    onEdit?.();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = validate(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    onSubmit(toPlaceInput(values));
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <TextField label="Tên địa điểm" value={values.name} maxLength={120} onChange={(e) => set('name', e.target.value)} error={errors.name} disabled={busy} />
        <TextField label="Địa chỉ" value={values.address} maxLength={300} onChange={(e) => set('address', e.target.value)} error={errors.address} disabled={busy} />
        <LocationPicker
          latitude={values.latitude}
          longitude={values.longitude}
          onChange={(latitude, longitude) => {
            setValues((current) => ({ ...current, latitude, longitude }));
            setErrors((current) => ({ ...current, latitude: null, longitude: null }));
            onEdit?.();
          }}
          error={errors.latitude || errors.longitude ? 'Hãy chọn vị trí hợp lệ trên bản đồ.' : null}
          disabled={busy}
        />
        <div className="form-grid__wide">
          <TextArea
            label="Mô tả (không bắt buộc)"
            value={values.description}
            maxLength={2000}
            onChange={(e) => set('description', e.target.value)}
            error={errors.description}
            disabled={busy}
          />
        </div>
        <ChoiceGroup legend="Wi-Fi" value={values.wifi} options={AMENITY_OPTIONS} onChange={(value) => set('wifi', value)} disabled={busy} />
        <ChoiceGroup legend="Ổ cắm" value={values.outlets} options={AMENITY_OPTIONS} onChange={(value) => set('outlets', value)} disabled={busy} />
        <TextField
          label="Giá nước thấp nhất (đồng, không bắt buộc)"
          inputMode="numeric"
          placeholder="25.000"
          value={values.price}
          onChange={(e) => set('price', e.target.value)}
          error={errors.price}
          hint="Để trống nếu chưa xác minh."
          disabled={busy}
        />
        {children}
        <div className="form-grid__wide form-actions">
          <Button type="submit" busy={busy} busyLabel="Đang lưu">
            {submitLabel}
          </Button>
          {onCancel ? (
            <Button variant="text" onClick={onCancel} disabled={busy}>
              Hủy
            </Button>
          ) : null}
          <FormAlert message={error} />
        </div>
      </div>
    </form>
  );
}
