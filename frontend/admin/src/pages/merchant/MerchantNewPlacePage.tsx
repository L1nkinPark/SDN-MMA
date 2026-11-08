import { useState } from 'react';
import { useNavigate } from 'react-router';

import { errorMessage } from '../../api/errors';
import { useCreateMerchantPlace } from '../../api/hooks';
import { PlaceForm } from '../../components/PlaceForm';
import { PageHeader, StateMessage, TextArea, TextField } from '../../components/ui';
import { evidenceError, parseLinks, phoneError } from '../../utils/validation';

/** `POST /api/merchant/places`: a new place with contact phone and evidence, waiting for an admin. */
export function MerchantNewPlacePage() {
  const navigate = useNavigate();
  const create = useCreateMerchantPlace();
  const [phone, setPhone] = useState('');
  const [evidence, setEvidence] = useState('');
  const [errors, setErrors] = useState<{ phone: string | null; evidence: string | null }>({ phone: null, evidence: null });

  if (create.isSuccess) {
    return (
      <>
        <PageHeader title="Đăng ký quán mới" />
        <StateMessage
          heading="Đã gửi hồ sơ quán"
          sentence={`${create.data.place?.name ?? 'Quán'} đang chờ quản trị viên duyệt. Quán chỉ hiện trong app sau khi được duyệt; bạn sẽ nhận thông báo kết quả.`}
          action={{ label: 'Về Quán của tôi', onClick: () => navigate('/merchant') }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Đăng ký quán mới" right="Mỗi tài khoản có tối đa 3 hồ sơ chờ duyệt." />
      <p className="section state__sentence">
        Quản trị viên kiểm tra minh chứng trước khi quán xuất hiện. Sau khi được duyệt, bạn cấu hình giờ mở cửa, đặt chỗ và mã QR tại quầy.
      </p>
      <div className="section">
        <PlaceForm
          submitLabel="Gửi hồ sơ quán"
          busy={create.isPending}
          error={create.isError ? errorMessage(create.error) : null}
          onEdit={() => {
            if (create.isError) create.reset();
          }}
          onCancel={() => navigate('/merchant')}
          onSubmit={(input) => {
            const found = { phone: phoneError(phone), evidence: evidenceError(evidence) };
            setErrors(found);
            if (found.phone || found.evidence) return;
            create.mutate({ ...input, contactPhone: phone.trim(), evidenceUrls: parseLinks(evidence) });
          }}>
          <TextField
            label="Số điện thoại của quán"
            inputMode="tel"
            value={phone}
            maxLength={20}
            onChange={(event) => {
              setPhone(event.target.value);
              setErrors((current) => ({ ...current, phone: null }));
            }}
            error={errors.phone}
            disabled={create.isPending}
          />
          <div className="form-grid__wide">
            <TextArea
              label="Link minh chứng (mỗi dòng một link https://, tối đa 5)"
              value={evidence}
              rows={3}
              onChange={(event) => {
                setEvidence(event.target.value);
                setErrors((current) => ({ ...current, evidence: null }));
              }}
              error={errors.evidence}
              hint="Ví dụ ảnh giấy phép kinh doanh, ảnh mặt tiền hoặc trang mạng xã hội của quán."
              disabled={create.isPending}
            />
          </div>
        </PlaceForm>
      </div>
    </>
  );
}
