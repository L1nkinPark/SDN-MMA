import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { authApi } from '../api/endpoints';
import { errorMessage, isApiError } from '../api/errors';
import { useSession } from '../auth/sessionContext';
import { Button, FormAlert, TextField } from '../components/ui';
import { emailError, passwordError } from '../utils/validation';

/** Only same-app paths are allowed as the return target. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export function LoginPage() {
  const { status, signIn, notice } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email: string | null; password: string | null }>({ email: null, password: null });

  const login = useMutation({
    mutationFn: async () => signIn(await authApi.login({ email, password })),
    onSuccess: () => navigate(next, { replace: true }),
  });

  if (status === 'signed-in') return <Navigate to={next} replace />;

  const wrongCredentials = isApiError(login.error) && login.error.status === 401;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (login.isPending) return;
    const found = { email: emailError(email), password: passwordError(password) };
    setErrors(found);
    if (found.email || found.password) return;
    login.mutate();
  }

  const alert = login.isError ? errorMessage(login.error) : notice;

  return (
    <div className="login">
      <div className="login__brand">StudySpot</div>
      <h1 className="login__title">Quản lý StudySpot</h1>
      <p className="state__sentence">
        Quản trị viên duyệt và kiểm duyệt nội dung. Chủ quán, hoặc sinh viên muốn đăng ký quán, đăng nhập bằng tài khoản StudySpot để gửi hồ sơ,
        tạo mã QR tại quầy và quản lý đặt chỗ.
      </p>
      <form className="login__form" onSubmit={submit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          placeholder="ten@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors((current) => ({ ...current, email: null }));
            if (login.isError) login.reset();
          }}
          error={errors.email}
          invalid={wrongCredentials}
          disabled={login.isPending}
        />
        <TextField
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          placeholder="Ít nhất 8 ký tự"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: null }));
            if (login.isError) login.reset();
          }}
          error={errors.password}
          invalid={wrongCredentials}
          disabled={login.isPending}
        />
        <FormAlert message={alert} />
        <Button type="submit" size="large" busy={login.isPending} busyLabel="Đang đăng nhập">
          Đăng nhập
        </Button>
        <Link to="/forgot-password">Quên mật khẩu?</Link>
        <p className="state__sentence">Chưa có tài khoản? <Link to="/register">Đăng ký sinh viên hoặc chủ quán</Link></p>
      </form>
    </div>
  );
}
