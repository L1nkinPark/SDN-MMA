import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { errorMessage } from '../../api/errors';
import { useVisitCode } from '../../api/hooks';
import type { Place } from '../../api/types';
import { Button, FormAlert, StateMessage } from '../../components/ui';

/**
 * The counter QR: `POST /api/merchant/places/{id}/visit-code` returns a code valid for 90 seconds.
 * With auto renew on, a new code is fetched just before the old one expires, so the screen can stay at the counter.
 */
export function VisitCodePanel({ place }: { place: Place }) {
  const generate = useVisitCode();
  const [code, setCode] = useState<{ value: string; expiresAt: number } | null>(null);
  const [autoRenew, setAutoRenew] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const { mutate, isPending } = generate;
  const placeId = place._id as string;

  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [code]);

  const secondsLeft = code ? Math.max(0, Math.round((code.expiresAt - now) / 1000)) : 0;
  // An expired code is never shown, whether or not a renewal is on its way.
  const shown = code && secondsLeft > 0 ? code : null;

  function create() {
    mutate(placeId, {
      onSuccess: (result) => setCode({ value: result.code, expiresAt: Date.now() + result.expiresInSeconds * 1000 }),
      onError: () => setCode(null),
    });
  }

  // Renew a few seconds early so the counter never shows a dead code.
  useEffect(() => {
    if (!code || isPending || !autoRenew || secondsLeft > 5) return;
    mutate(placeId, {
      onSuccess: (result) => setCode({ value: result.code, expiresAt: Date.now() + result.expiresInSeconds * 1000 }),
      onError: () => setCode(null),
    });
  }, [secondsLeft, autoRenew, code, isPending, mutate, placeId]);

  if (place.business?.temporaryClosed) {
    return (
      <StateMessage
        heading="Quán đang tạm đóng cửa"
        sentence="Mã QR chỉ tạo được khi quán mở. Tắt Tạm đóng cửa ở tab Vận hành để tạo mã."
      />
    );
  }

  return (
    <div className="section qr">
      <div className="qr__text">
        <h2 className="settings__title">Mã QR tại quầy</h2>
        <p className="state__sentence">
          Khách quét mã này khi check-in trong app. Check-in được đánh dấu đã xác minh nếu khách ở trong quán (cách tối đa 100 m) và GPS chính xác dưới 50 m.
          Đánh giá của khách trong 14 ngày sau đó có nhãn đã xác minh.
        </p>
        <p className="field__hint">Mỗi mã chỉ dùng được khoảng 90 giây. GPS và QR có thể bị giả; để chắc chắn khách đã đến, hãy bấm Khách đã đến trong tab Đặt chỗ.</p>
        <label className="hours__day">
          <input type="checkbox" checked={autoRenew} onChange={(event) => setAutoRenew(event.target.checked)} />
          Tự tạo mã mới trước khi hết hạn
        </label>
        <div className="form-actions">
          <Button onClick={create} busy={isPending && !shown} busyLabel="Đang tạo">
            {shown ? 'Tạo mã mới ngay' : 'Tạo mã QR'}
          </Button>
          {shown ? (
            <Button variant="text" onClick={() => setCode(null)}>
              Ẩn mã
            </Button>
          ) : null}
        </div>
        <FormAlert message={generate.isError ? errorMessage(generate.error) : null} />
      </div>
      {shown ? (
        <figure className="qr__code" aria-label="Mã QR check-in">
          <QRCodeSVG value={shown.value} size={240} marginSize={2} />
          <figcaption className={secondsLeft <= 15 ? 'qr__expiry qr__expiry--soon' : 'qr__expiry'} aria-live="polite">
            {isPending ? 'Đang làm mới mã' : `Còn ${secondsLeft} giây`}
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}
