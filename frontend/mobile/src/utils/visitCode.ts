/**
 * The counter QR holds a short-lived signed token from `POST /api/merchant/places/{id}/visit-code`
 * (a JWT with `type: 'visit_qr'`, `place` and a 90 second expiry). The backend verifies the signature;
 * the app only reads the payload to catch the wrong QR, another place's QR or an expired one early.
 */

export type VisitCodeCheck =
  | { ok: true; code: string; expiresAt: number | null }
  | { ok: false; reason: 'format' | 'other-place' | 'expired' };

export const VISIT_CODE_MESSAGES: Record<Exclude<VisitCodeCheck, { ok: true }>['reason'], string> = {
  format: 'Đây không phải mã QR check-in của StudySpot. Hãy quét mã quán hiển thị tại quầy.',
  'other-place': 'Mã QR này thuộc một địa điểm khác.',
  expired: 'Mã QR đã hết hạn. Nhờ quán tạo mã mới rồi quét lại.',
};

/** Accuracy and distance the backend requires for a QR-verified check-in. */
export const VERIFIED_MAX_ACCURACY_M = 50;
export const VERIFIED_MAX_DISTANCE_M = 100;

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  // The payload is ASCII (type, ObjectIds, numbers), so the decoded bytes are already the JSON text.
  return JSON.parse(globalThis.atob(padded));
}

export function checkVisitCode(data: string, placeId: string, now: number = Date.now()): VisitCodeCheck {
  const code = data.trim();
  const parts = code.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'format' };
  let payload: unknown;
  try {
    payload = decodeSegment(parts[1]);
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'format' };
  const claims = payload as { type?: unknown; place?: unknown; exp?: unknown };
  if (claims.type !== 'visit_qr') return { ok: false, reason: 'format' };
  if (claims.place !== placeId) return { ok: false, reason: 'other-place' };
  const expiresAt = typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  if (expiresAt !== null && expiresAt <= now) return { ok: false, reason: 'expired' };
  return { ok: true, code, expiresAt };
}
