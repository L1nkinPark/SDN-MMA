import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { errorMessage } from '../../api/errors';
import { merchantApi } from '../../api/endpoints';
import { useCreateMerchantPlace } from '../../api/hooks';
import { PlaceForm } from '../../components/PlaceForm';
import { Button, FormAlert, PageHeader, StateMessage, TextArea, TextField } from '../../components/ui';
import { evidenceError, parseLinks, phoneError } from '../../utils/validation';

/** `POST /api/merchant/places`: a new place with contact phone and evidence, waiting for an admin. */
export function MerchantNewPlacePage() {
  const navigate = useNavigate();
  const create = useCreateMerchantPlace();
  const [phone, setPhone] = useState('');
  const [evidence, setEvidence] = useState('');
  const [errors, setErrors] = useState<{ phone: string | null; evidence: string | null }>({ phone: null, evidence: null });
  const [initialImage, setInitialImage] = useState<File | null>(null);
  const upload = useMutation({ mutationFn: ({ id, file }: { id: string; file: File }) => merchantApi.uploadInitialImage(id, file),
    onSuccess: () => setInitialImage(null) });

  if (create.isSuccess) {
    return (
      <>
        <PageHeader title="Đăng ký quán mới" />
        <StateMessage
          heading="Đã gửi hồ sơ quán"
          sentence={`${create.data.place?.name ?? 'Quán'} đang chờ quản trị viên duyệt. Quán chỉ hiện trong app sau khi được duyệt; bạn sẽ nhận thông báo kết quả.`}
          action={{ label: 'Về Quán của tôi', onClick: () => navigate('/merchant') }}
        />
        <div className="section">
          <h2>Ảnh hồ sơ ban đầu</h2>
          <p className="field__hint">Tải tối đa 5 ảnh mặt tiền hoặc không gian học. Admin kiểm tra và có thể gỡ ảnh trước khi quán công khai.</p>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setInitialImage(event.target.files?.[0] ?? null)} />
          <Button size="small" variant="secondary" disabled={!initialImage || upload.isPending}
            busy={upload.isPending} onClick={() => { if (initialImage && create.data.place?._id) upload.mutate({ id: create.data.place._id, file: initialImage }); }}>
            Tải ảnh lên
          </Button>
          <FormAlert message={upload.isError ? errorMessage(upload.error) : null} />
          {upload.isSuccess ? <p className="field__hint">Đã thêm ảnh vào hồ sơ chờ duyệt.</p> : null}
        </div>
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
