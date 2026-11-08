import assert from 'node:assert/strict';
import test from 'node:test';
import { renderEmail } from '../src/services/emailTemplate.js';

test('notification email has a readable layout and escapes user content', () => {
  const html = renderEmail({ subject: '[StudySpot] Địa điểm đã được duyệt',
    text: 'Quán <Bàn Học> & Co: Đã duyệt.' });
  assert.match(html, /lang="vi"/);
  assert.match(html, /THÔNG TIN ĐỊA ĐIỂM/);
  assert.match(html, /<h1[^>]*>Địa điểm đã được duyệt<\/h1>/);
  assert.match(html, /Quán &lt;Bàn Học&gt; &amp; Co/);
  assert.doesNotMatch(html, /<Bàn Học>/);
});

test('account email shows the confirmation code in a dedicated block', () => {
  const token = 'a'.repeat(64);
  const html = renderEmail({ subject: '[StudySpot] Đặt lại mật khẩu',
    text: `Mã đặt lại mật khẩu của bạn: ${token}\nMã có hiệu lực 30 phút.` });
  assert.match(html, /BẢO MẬT TÀI KHOẢN/);
  assert.match(html, new RegExp(`word-break:break-word">${token}<`));
  assert.match(html, /Mã có hiệu lực 30 phút/);
});
