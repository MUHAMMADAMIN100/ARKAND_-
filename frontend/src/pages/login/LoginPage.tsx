import { useForm } from 'react-hook-form';
import { zodForm as zodResolver } from '../../shared';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { FiHexagon } from 'react-icons/fi';
import { loginSchema, type LoginInput, type LoginResponse } from '@sheben/shared';
import { http, HttpError } from '../../shared/api/http';
import { useAuthStore } from '../../shared/auth/auth.store';
import { Button, Field, Input } from '../../shared';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    setServerError(null);
    try {
      const res = await http.post<LoginResponse>('/auth/login', data, { skipAuth: true });
      setSession(res);
      navigate('/', { replace: true });
    } catch (e) {
      setServerError(e instanceof HttpError ? e.message : 'Ошибка входа');
    }
  };

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.brand}>
          <span className={styles.icon}>
            <FiHexagon />
          </span>
          <h1 className={styles.title}>Щебёночный завод</h1>
          <p className={styles.sub}>Система учёта карьера</p>
        </div>

        <Field label="Логин" error={errors.login?.message} required>
          <Input placeholder="operator" autoComplete="username" autoFocus {...register('login')} />
        </Field>
        <Field label="Пароль" error={errors.password?.message} required>
          <Input type="password" placeholder="••••••••" autoComplete="current-password" {...register('password')} />
        </Field>

        {serverError && <div className={styles.serverError}>{serverError}</div>}

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Войти
        </Button>
      </form>
    </div>
  );
}
