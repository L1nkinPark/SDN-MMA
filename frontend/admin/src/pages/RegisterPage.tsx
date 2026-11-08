import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';

import { authApi } from '../api/endpoints';
import { errorMessage, isApiError } from '../api/errors';
import { useSession } from '../auth/sessionContext';
import { Button, ChoiceGroup, FormAlert, TextField } from '../components/ui';
import { emailError, nameError, passwordError } from '../utils/validation';

type Intent = 'student' | 'merchant';
type Field = 'name' | 'email' | 'password' | 'confirmation';
type Errors = Record<Field, string | null>;
const NO_ERRORS: Errors = { name: null, email: null, password: null, confirmation: null };

export function RegisterPage() {
  const { status, signIn } = useSession();
  const [params] = useSearchParams();
  const [intent, setIntent] = useState<Intent>(params.get('intent') === 'merchant' ? 'merchant' : 'student');
  const [values, setValues] = useState<Record<Field, string>>({ name: '', email: '', password: '', confirmation: '' });
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);
  const [registered, setRegistered] = useState(false);

  const register = useMutation({
    mutationFn: () => authApi.register(values),
    onSuccess: async (result) => {
      setRegistered(true);
      await signIn(result);
    },
  });

  if (registered) {
    return (
      <main className="login">
        <div className="login__brand">StudySpot</div>
        <h1 className="login__title">Tạo tài khoản thành công</h1>
        {intent === 'student' ? (
          <p className="state__sentence">Bạn đã có tài khoản sinh viên. Hãy dùng email và mật khẩu vừa tạo để đăng nhập ứng dụng StudySpot trên điện thoại, tìm chỗ học và đặt chỗ.</p>
        ) : (
          <>
            <p className="state__sentence">Tài khoản của bạn đã được tạo. Để quản lý quán, hãy gửi một trong hai hồ sơ bên dưới. Admin sẽ kiểm tra minh chứng trước khi cấp quyền chủ quán.</p>
            <div className="login__form">
              <Link className="btn btn--primary btn--large" to="/merchant/new">Đăng ký quán mới</Link>
              <Link className="btn btn--secondary btn--large" to="/merchant/claim">Nhận quyền quán đã có</Link>
            </div>
          </>
        )}
      </main>
    );
  }
  if (status === 'signed-in') return <Navigate to="/merchant" replace />;

  const emailTaken = isApiError(register.error) && register.error.status === 409;
  const formError = register.isError && !emailTaken ? errorMessage(register.error) : null;

  function change(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: null }));
    if (register.isError) register.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (register.isPending) return;
    const found: Errors = {
      name: nameError(values.name),
      email: emailError(values.email),
      password: passwordError(values.password),
      confirmation: values.confirmation !== values.password ? 'Mật khẩu nhập lại chưa khớp.' : null,
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    register.mutate();
  }

  return (
    <main className="login">
      <div className="login__brand">StudySpot</div>
      <h1 className="login__title">Tạo tài khoản</h1>
      <p className="state__sentence">Chọn cách bạn muốn dùng StudySpot. Mọi tài khoản mới đều bắt đầu là sinh viên.</p>
      <form className="login__form" onSubmit={submit} noValidate>
        <ChoiceGroup<Intent>
          legend="Bạn muốn đăng ký để"
          value={intent}
          options={[{ value: 'student', label: 'Tìm chỗ học' }, { value: 'merchant', label: 'Quản lý quán' }]}
          onChange={setIntent}
          disabled={register.isPending}
        />
        <p className="state__sentence" role="status">
          {intent === 'merchant'
            ? 'Sau khi tạo tài khoản, bạn gửi hồ sơ quán và minh chứng. Chỉ khi admin duyệt, bạn mới có quyền chủ quán.'
            : 'Dùng tài khoản này trên ứng dụng điện thoại để tìm địa điểm, check-in, đặt chỗ và đánh giá.'}
        </p>
        <TextField label="Họ và tên" autoComplete="name" value={values.name} maxLength={80}
          onChange={(event) => change('name', event.target.value)} error={errors.name} disabled={register.isPending} />
        <TextField label="Email" type="email" autoComplete="email" value={values.email}
          onChange={(event) => change('email', event.target.value)} error={errors.email ?? (emailTaken ? 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.' : null)} disabled={register.isPending} />
        <TextField label="Mật khẩu" type="password" autoComplete="new-password" value={values.password} maxLength={128}
          onChange={(event) => change('password', event.target.value)} error={errors.password} disabled={register.isPending} />
        <TextField label="Nhập lại mật khẩu" type="password" autoComplete="new-password" value={values.confirmation} maxLength={128}
          onChange={(event) => change('confirmation', event.target.value)} error={errors.confirmation} disabled={register.isPending} />
        <FormAlert message={formError} />
        <Button type="submit" size="large" busy={register.isPending} busyLabel="Đang tạo tài khoản">Đăng ký</Button>
        <p className="state__sentence">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
      </form>
    </main>
  );
}
