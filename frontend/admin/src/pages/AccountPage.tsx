import { useState, type FormEvent } from 'react';

import { errorMessage, isApiError } from '../api/errors';
import { useChangePassword } from '../api/hooks';
import { useSession } from '../auth/sessionContext';
import { Button, FormAlert, PageHeader, TextField } from '../components/ui';
import { PERMISSION_LABELS, USER_ROLE_LABELS } from '../utils/labels';
import { passwordError } from '../utils/validation';

type Errors = { current: string | null; next: string | null; confirm: string | null };
const NO_ERRORS: Errors = { current: null, next: null, confirm: null };

/** Tài khoản: who is signed in, and a password change (every session is revoked afterwards). */
export function AccountPage() {
  const { user, signOut } = useSession();
  const change = useChangePassword();
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);
  const wrongCurrent = isApiError(change.error) && change.error.status === 403;

  function set(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: null }));
    if (change.isError) change.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (change.isPending) return;
    const found: Errors = {
      current: passwordError(values.current),
      next: passwordError(values.next) ?? (values.next === values.current ? 'Mật khẩu mới phải khác mật khẩu hiện tại.' : null),
      confirm: values.confirm === values.next ? null : 'Mật khẩu nhập lại chưa khớp.',
    };
    setErrors(found);
    if (found.current || found.next || found.confirm) return;
    change.mutate(
      { currentPassword: values.current, newPassword: values.next },
      { onSuccess: () => void signOut('Đã đổi mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới.') },
    );
  }

  const permissions = user?.role === 'admin' ? (user.adminPermissions?.length ? user.adminPermissions : ['*' as const]) : [];

  return (
    <>
      <PageHeader title="Tài khoản" />
      <div className="section">
        <p className="row__title">{user?.name}</p>
        <p className="row__secondary">
          {user?.email} · {user?.role ? USER_ROLE_LABELS[user.role] : ''}
        </p>
        {permissions.length ? (
          <p className="row__secondary">Quyền: {permissions.map((permission) => PERMISSION_LABELS[permission]).join(', ')}</p>
        ) : null}
      </div>
      <form className="section settings" onSubmit={submit} noValidate>
        <h2 className="settings__title">Đổi mật khẩu</h2>
        <p className="state__sentence">Sau khi đổi, bạn được đăng xuất trên mọi thiết bị, kể cả ứng dụng di động.</p>
        <div className="form-grid">
          <TextField
            label="Mật khẩu hiện tại"
            type="password"
            autoComplete="current-password"
            value={values.current}
            onChange={(event) => set('current', event.target.value)}
            error={errors.current ?? (wrongCurrent ? errorMessage(change.error) : null)}
            disabled={change.isPending}
          />
          <span />
          <TextField
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            value={values.next}
            maxLength={128}
            onChange={(event) => set('next', event.target.value)}
            error={errors.next}
            hint="Ít nhất 8 ký tự."
            disabled={change.isPending}
          />
          <TextField
            label="Nhập lại mật khẩu mới"
            type="password"
            autoComplete="new-password"
            value={values.confirm}
            maxLength={128}
            onChange={(event) => set('confirm', event.target.value)}
            error={errors.confirm}
            disabled={change.isPending}
          />
          <div className="form-grid__wide form-actions">
            <Button type="submit" busy={change.isPending} busyLabel="Đang lưu">
              Đổi mật khẩu
            </Button>
            <FormAlert message={change.isError && !wrongCurrent ? errorMessage(change.error) : null} />
          </div>
        </div>
      </form>
    </>
  );
}
