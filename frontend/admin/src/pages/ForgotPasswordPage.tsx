import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { authApi } from '../api/endpoints';
import { errorMessage } from '../api/errors';
import { Button, FormAlert, TextField } from '../components/ui';
import { emailError, passwordError } from '../utils/validation';

/** Public page: send a reset code by email, then set a new password with it. */
export function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; code?: string | null; password?: string | null }>({});
  const forgot = useMutation({ mutationFn: () => authApi.forgotPassword(email) });
  const reset = useMutation({ mutationFn: () => authApi.resetPassword(code, password) });

  function sendCode(event: FormEvent) {
    event.preventDefault();
    const error = emailError(email);
    setErrors({ email: error });
    if (error || forgot.isPending) return;
    forgot.mutate(undefined, { onSuccess: () => setStep('code') });
  }

  function submitReset(event: FormEvent) {
    event.preventDefault();
    const length = code.trim().length;
    const found = {
      code: length < 32 || length > 256 ? 'Mã chưa đúng. Hãy sao chép đủ mã trong email.' : null,
      password: passwordError(password),
    };
    setErrors(found);
    if (found.code || found.password || reset.isPending) return;
    reset.mutate();
  }

  return (
    <div className="login">
      <div className="login__brand">StudySpot</div>
      <h1 className="login__title">Đặt lại mật khẩu</h1>
      {reset.isSuccess ? (
        <>
          <p className="state__sentence">Đã đổi mật khẩu. Các phiên đăng nhập cũ đã bị thu hồi.</p>
          <Link className="btn btn--primary btn--large" to="/login">
            Đăng nhập
          </Link>
        </>
      ) : step === 'email' ? (
        <form className="login__form" onSubmit={sendCode} noValidate>
          <p className="state__sentence">Nhập email đã đăng ký. StudySpot gửi một mã có hiệu lực 30 phút.</p>
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors({});
              if (forgot.isError) forgot.reset();
            }}
            error={errors.email}
            disabled={forgot.isPending}
          />
          <FormAlert message={forgot.isError ? errorMessage(forgot.error) : null} />
          <Button type="submit" size="large" busy={forgot.isPending} busyLabel="Đang gửi">
            Gửi mã
          </Button>
          <Link to="/login">Quay lại đăng nhập</Link>
        </form>
      ) : (
        <form className="login__form" onSubmit={submitReset} noValidate>
          <p className="state__sentence">
            Nếu {email.trim().toLowerCase()} có tài khoản, mã đã được gửi tới hộp thư (xem cả thư rác).
          </p>
          <TextField
            label="Mã trong email"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setErrors((current) => ({ ...current, code: null }));
              if (reset.isError) reset.reset();
            }}
            error={errors.code}
            disabled={reset.isPending}
          />
          <TextField
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            value={password}
            maxLength={128}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: null }));
              if (reset.isError) reset.reset();
            }}
            error={errors.password}
            hint="Ít nhất 8 ký tự."
            disabled={reset.isPending}
          />
          <FormAlert message={reset.isError ? errorMessage(reset.error) : forgot.isError ? errorMessage(forgot.error) : null} />
          <Button type="submit" size="large" busy={reset.isPending} busyLabel="Đang lưu">
            Đặt lại mật khẩu
          </Button>
          <Button variant="text" busy={forgot.isPending} onClick={() => forgot.mutate()}>
            Gửi lại mã
          </Button>
        </form>
      )}
    </div>
  );
}
