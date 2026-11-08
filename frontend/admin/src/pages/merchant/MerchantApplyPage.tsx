import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import { merchantApi } from '../../api/endpoints';
import { errorMessage } from '../../api/errors';
import { useSession } from '../../auth/sessionContext';
import { Button, FormAlert, LoadingRows, PageHeader, StateMessage, TextField } from '../../components/ui';
import { evidenceError, parseLinks, phoneError } from '../../utils/validation';

export function MerchantApplyPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const application = useQuery({ queryKey: ['merchant', 'account-application'], queryFn: merchantApi.accountApplication });
  const [businessName, setBusinessName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [evidence, setEvidence] = useState('');
  const [errors, setErrors] = useState<{ businessName: string | null; contactPhone: string | null; evidence: string | null }>({
    businessName: null, contactPhone: null, evidence: null,
  });
  const submit = useMutation({
    mutationFn: merchantApi.applyForAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['merchant', 'account-application'] }),
  });

  if (user?.role === 'merchant') return <Navigate to="/merchant" replace />;
  if (application.isPending) return <LoadingRows rows={2} />;
  if (application.isError) return <StateMessage tone="error" heading="Chưa tải được hồ sơ"
    sentence={errorMessage(application.error)} action={{ label: 'Thử lại', onClick: () => void application.refetch() }} />;
  if (application.data?.application?.status === 'pending') return <StateMessage heading="Hồ sơ tài khoản đang chờ duyệt"
    sentence="Admin đang kiểm tra hồ sơ. Sau khi được duyệt, bạn mới có thể đăng ký và quản lý quán."
    action={{ label: 'Về hồ sơ', onClick: () => navigate('/merchant') }} />;

  function send(event: FormEvent) {
    event.preventDefault();
    const found = { businessName: businessName.trim().length < 2 ? 'Nhập tên cơ sở kinh doanh (ít nhất 2 ký tự).' : null,
      contactPhone: phoneError(contactPhone), evidence: evidenceError(evidence) };
    setErrors(found);
    if (Object.values(found).some(Boolean) || submit.isPending) return;
    submit.mutate({ businessName: businessName.trim(), contactPhone: contactPhone.trim(), evidenceUrls: parseLinks(evidence) });
  }

  return <>
    <PageHeader title="Đăng ký tài khoản chủ quán" />
    {application.data?.application?.status === 'rejected' ? <p className="section state__sentence">
      Hồ sơ trước chưa được duyệt: {application.data.application.decisionNote ?? 'Vui lòng bổ sung minh chứng và gửi lại.'}
    </p> : null}
    <p className="section state__sentence">Admin duyệt tài khoản trước. Sau đó bạn mới được gửi hồ sơ quán mới hoặc nhận quyền quán đã có.</p>
    <form className="section login__form" onSubmit={send} noValidate>
      <TextField label="Tên cơ sở kinh doanh" value={businessName} maxLength={120}
        onChange={(event) => { setBusinessName(event.target.value); setErrors((current) => ({ ...current, businessName: null })); }}
        error={errors.businessName} disabled={submit.isPending} />
      <TextField label="Số điện thoại liên hệ" value={contactPhone} maxLength={20}
        onChange={(event) => { setContactPhone(event.target.value); setErrors((current) => ({ ...current, contactPhone: null })); }}
        error={errors.contactPhone} disabled={submit.isPending} />
      <TextField label="Link minh chứng (HTTPS, mỗi dòng một link)" value={evidence}
        onChange={(event) => { setEvidence(event.target.value); setErrors((current) => ({ ...current, evidence: null })); }}
        error={errors.evidence} disabled={submit.isPending} />
      <FormAlert message={submit.isError ? errorMessage(submit.error) : null} />
      <Button type="submit" busy={submit.isPending}>Gửi hồ sơ tài khoản</Button>
      <Link to="/merchant">Về Quán của tôi</Link>
    </form>
  </>;
}
