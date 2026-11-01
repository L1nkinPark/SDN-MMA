import { reportDetailError } from '@/utils/validation';

import { REPORT_REASONS, REPORT_STATUS_LABELS } from '../reports';

describe('reports', () => {
  it('lists reasons in the required order', () => {
    expect(REPORT_REASONS.map((r) => r.value)).toEqual(['closed', 'incorrect_info', 'inappropriate', 'other']);
  });

  it('labels statuses in Vietnamese', () => {
    expect(REPORT_STATUS_LABELS).toEqual({ pending: 'Đang chờ', resolved: 'Đã xử lý', dismissed: 'Đã bỏ qua' });
  });

  it('checks detail length 10 to 2000 after trimming', () => {
    expect(reportDetailError('Sai giờ')).toBe('Chi tiết cần ít nhất 10 ký tự.');
    expect(reportDetailError('Quán đã đóng cửa')).toBeNull();
    expect(reportDetailError('x'.repeat(2001))).toBe('Chi tiết tối đa 2.000 ký tự.');
  });
});
