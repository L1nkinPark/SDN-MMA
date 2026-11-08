function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function category(title) {
  if (/mật khẩu|email đăng nhập|xác nhận email/i.test(title)) return 'BẢO MẬT TÀI KHOẢN';
  if (/booking|đặt chỗ/i.test(title)) return 'LỊCH ĐẶT CHỖ';
  if (/địa điểm|quán|cửa hàng/i.test(title)) return 'THÔNG TIN ĐỊA ĐIỂM';
  return 'THÔNG BÁO';
}

function bodyHtml(text) {
  return String(text).split(/\n+/).filter(Boolean).map(line => {
    const code = line.match(/^(Mã (?:xác nhận email mới|đặt lại mật khẩu) của bạn): ([a-f\d]{64})$/i);
    if (code) return `<p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:1.6">${escapeHtml(code[1])}:</p>
      <div style="margin:0 0 22px;padding:18px 20px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;color:#0f172a;font-size:17px;font-weight:700;letter-spacing:1px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(code[2])}</div>`;
    return `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.75;overflow-wrap:anywhere">${escapeHtml(line)}</p>`;
  }).join('');
}

/** Responsive table layout for mail clients; the text version remains the plain-text fallback. */
export function renderEmail({ subject, text }) {
  const title = String(subject).replace(/^\[StudySpot\]\s*/i, '').trim();
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(title)} — thông báo từ StudySpot.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f1f5f9"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;border-collapse:separate;border-spacing:0">
      <tr><td style="padding:24px 30px;background:#0f172a;border-radius:16px 16px 0 0">
        <span style="color:#ffffff;font-size:25px;font-weight:700;letter-spacing:-.5px">Study<span style="color:#f97316">Spot</span></span><br>
        <span style="color:#cbd5e1;font-size:12px;line-height:1.7">Tìm không gian học phù hợp với bạn</span>
      </td></tr>
      <tr><td style="padding:32px 30px 24px;background:#ffffff">
        <div style="margin:0 0 12px;color:#ea580c;font-size:11px;font-weight:700;letter-spacing:1.5px">${category(title)}</div>
        <h1 style="margin:0 0 22px;color:#0f172a;font-size:25px;line-height:1.35">${escapeHtml(title)}</h1>
        ${bodyHtml(text)}
        <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.7">Mở StudySpot để xem thông tin mới nhất và thực hiện các bước tiếp theo.</p>
      </td></tr>
      <tr><td style="padding:22px 30px;background:#e2e8f0;border-radius:0 0 16px 16px;color:#64748b;font-size:12px;line-height:1.7">
        Email được gửi tự động từ StudySpot. Vui lòng không trả lời email này. Nếu bạn không thực hiện yêu cầu liên quan đến tài khoản, hãy đổi mật khẩu và liên hệ quản trị viên.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
