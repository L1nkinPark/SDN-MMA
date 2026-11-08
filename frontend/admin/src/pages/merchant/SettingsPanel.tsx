import { useState, type FormEvent } from 'react';

import { BOOKINGS_BLOCK_MESSAGE, errorMessage } from '../../api/errors';
import { useUpdateMerchantPlace } from '../../api/hooks';
import type { Place } from '../../api/types';
import { Button, ChoiceGroup, FormAlert, TextField } from '../../components/ui';
import { DAY_LABELS } from '../../utils/labels';
import {
  settingsChanges,
  settingsFromPlace,
  validateSettings,
  type SettingsErrors,
  type SettingsValues,
  type SlotMinutes,
} from '../../utils/merchantForm';
import { AMENITY_OPTIONS } from '../../utils/placeForm';
import { dateKeyLabel, latestClosedDate, vnDateKey } from '../../utils/vnTime';

const SLOT_OPTIONS: { value: SlotMinutes; label: string }[] = [
  { value: 30, label: '30 phút' },
  { value: 60, label: '60 phút' },
  { value: 120, label: '120 phút' },
];

const MODE_OPTIONS: { value: 'auto' | 'manual'; label: string }[] = [
  { value: 'auto', label: 'Tự xác nhận khi còn chỗ' },
  { value: 'manual', label: 'Quán duyệt từng lượt' },
];

const YES_NO: { value: boolean; label: string }[] = [
  { value: true, label: 'Có' },
  { value: false, label: 'Không' },
];

/** Opening hours, closed dates, capacity, amenities and booking rules: `PATCH /api/merchant/places/{id}`. */
export function SettingsPanel({ place, onShowBookings }: { place: Place; onShowBookings: () => void }) {
  const update = useUpdateMerchantPlace();
  const [values, setValues] = useState<SettingsValues>(() => settingsFromPlace(place));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [newDate, setNewDate] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const today = vnDateKey();

  function set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setNotice(null);
    if (update.isError) update.reset();
  }

  function setDay(day: number, patch: Partial<SettingsValues['hours'][number]>) {
    set(
      'hours',
      values.hours.map((item) => (item.day === day ? { ...item, ...patch } : item)),
    );
  }

  function addDate() {
    if (!newDate || newDate < today || values.closedDates.includes(newDate)) return;
    set('closedDates', [...values.closedDates, newDate].sort());
    setNewDate('');
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (update.isPending || !place._id) return;
    const found = validateSettings(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    const changes = settingsChanges(place, values);
    if (Object.keys(changes).length === 0) {
      setNotice('Chưa có thay đổi nào để lưu.');
      return;
    }
    update.mutate(
      { id: place._id, changes },
      {
        onSuccess: (result) => {
          if (result.place) setValues(settingsFromPlace(result.place));
          setNotice('Đã lưu thay đổi. Khách thấy thông tin mới ngay trong app.');
        },
      },
    );
  }

  const blockedByBookings = update.isError && update.error.message === BOOKINGS_BLOCK_MESSAGE;

  return (
    <form className="section settings" onSubmit={save} noValidate>
      <h2 className="settings__title">Trạng thái quán</h2>
      <ChoiceGroup
        legend="Tạm đóng cửa"
        value={values.temporaryClosed}
        options={YES_NO}
        onChange={(value) => set('temporaryClosed', value)}
        disabled={update.isPending}
      />
      <p className="field__hint">Khi tạm đóng, quán không nhận đặt chỗ mới và không tạo được mã QR.</p>

      <h2 className="settings__title">Giờ mở cửa (giờ Việt Nam)</h2>
      <div className="hours" role="group" aria-label="Giờ mở cửa theo ngày">
        {values.hours.map((item) => (
          <div className="hours__row" key={item.day}>
            <label className="hours__day">
              <input
                type="checkbox"
                checked={item.open}
                onChange={(event) => setDay(item.day, { open: event.target.checked })}
                disabled={update.isPending}
              />
              {DAY_LABELS[item.day]}
            </label>
            <input
              type="time"
              className="field__input hours__time"
              aria-label={`Giờ mở cửa ${DAY_LABELS[item.day]}`}
              value={item.from}
              disabled={!item.open || update.isPending}
              onChange={(event) => setDay(item.day, { from: event.target.value })}
            />
            <span aria-hidden="true">–</span>
            <input
              type="time"
              className="field__input hours__time"
              aria-label={`Giờ đóng cửa ${DAY_LABELS[item.day]}`}
              value={item.to}
              disabled={!item.open || update.isPending}
              onChange={(event) => setDay(item.day, { to: event.target.value })}
            />
            {!item.open ? <span className="row__secondary">Nghỉ</span> : null}
          </div>
        ))}
      </div>
      {errors.hours ? <p className="field__error">{errors.hours}</p> : null}

      <h2 className="settings__title">Ngày nghỉ</h2>
      <div className="form-actions">
        <TextField
          label="Thêm ngày nghỉ"
          type="date"
          min={today}
          max={latestClosedDate()}
          value={newDate}
          onChange={(event) => setNewDate(event.target.value)}
          disabled={update.isPending}
        />
        <Button variant="secondary" size="small" onClick={addDate} disabled={!newDate || newDate < today || update.isPending}>
          Thêm
        </Button>
      </div>
      {values.closedDates.length ? (
        <ul className="date-list">
          {values.closedDates.map((date) => (
            <li key={date}>
              <span>{dateKeyLabel(date)}</span>
              <Button
                variant="text"
                size="small"
                onClick={() => set('closedDates', values.closedDates.filter((item) => item !== date))}
                disabled={update.isPending}>
                Bỏ
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field__hint">Chưa có ngày nghỉ sắp tới.</p>
      )}
      {errors.closedDates ? <p className="field__error">{errors.closedDates}</p> : null}

      <h2 className="settings__title">Đặt chỗ</h2>
      <ChoiceGroup
        legend="Nhận đặt chỗ qua app"
        value={values.bookingEnabled}
        options={YES_NO}
        onChange={(value) => set('bookingEnabled', value)}
        disabled={update.isPending}
      />
      <div className="form-grid">
        <ChoiceGroup
          legend="Cách xác nhận"
          value={values.approvalMode}
          options={MODE_OPTIONS}
          onChange={(value) => set('approvalMode', value)}
          disabled={update.isPending}
        />
        <ChoiceGroup
          legend="Độ dài một khung giờ"
          value={values.slotMinutes}
          options={SLOT_OPTIONS}
          onChange={(value) => set('slotMinutes', value)}
          disabled={update.isPending}
        />
        <TextField
          label="Số chỗ mỗi khung giờ"
          inputMode="numeric"
          value={values.capacityPerSlot}
          onChange={(event) => set('capacityPerSlot', event.target.value)}
          error={errors.capacityPerSlot}
          hint="Tổng số người đặt tối đa cho mỗi khung giờ."
          disabled={update.isPending}
        />
      </div>
      <p className="field__hint">
        Khi còn booking sắp tới, không đổi được độ dài khung hoặc số chỗ; đóng cửa, ngày nghỉ và giờ mở cửa cũng không được làm mất các booking đó.
      </p>

      <h2 className="settings__title">Thông tin tại quán</h2>
      <div className="form-grid">
        <TextField
          label="Số điện thoại"
          inputMode="tel"
          value={values.phone}
          maxLength={20}
          onChange={(event) => set('phone', event.target.value)}
          error={errors.phone}
          disabled={update.isPending}
        />
        <TextField
          label="Số ghế (không bắt buộc)"
          inputMode="numeric"
          value={values.seatingCapacity}
          onChange={(event) => set('seatingCapacity', event.target.value)}
          error={errors.seatingCapacity}
          disabled={update.isPending}
        />
        <ChoiceGroup legend="Wi-Fi" value={values.wifi} options={AMENITY_OPTIONS} onChange={(value) => set('wifi', value)} disabled={update.isPending} />
        <ChoiceGroup legend="Ổ cắm" value={values.outlets} options={AMENITY_OPTIONS} onChange={(value) => set('outlets', value)} disabled={update.isPending} />
        <TextField
          label="Giá nước thấp nhất (đồng)"
          inputMode="numeric"
          placeholder="25.000"
          value={values.price}
          onChange={(event) => set('price', event.target.value)}
          error={errors.price}
          hint="Để trống nếu chưa muốn công bố."
          disabled={update.isPending}
        />
      </div>

      <div className="form-actions settings__actions">
        <Button type="submit" busy={update.isPending} busyLabel="Đang lưu">
          Lưu thay đổi
        </Button>
        <Button variant="text" onClick={() => setValues(settingsFromPlace(place))} disabled={update.isPending}>
          Hoàn tác
        </Button>
        <FormAlert message={update.isError ? errorMessage(update.error) : null} />
        {blockedByBookings ? (
          <Button variant="secondary" size="small" onClick={onShowBookings}>
            Xem booking sắp tới
          </Button>
        ) : null}
        {notice ? (
          <p className="notice" role="status">
            {notice}
          </p>
        ) : null}
      </div>
    </form>
  );
}
