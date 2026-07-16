import { z } from 'zod';
import { Role } from '../enums';

export const loginSchema = z.object({
  login: z
    .string()
    .min(3, 'Логин — минимум 3 символа')
    .max(64, 'Логин — максимум 64 символа')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Логин: латиница, цифры, точка, дефис, подчёркивание'),
  password: z.string().min(6, 'Пароль — минимум 6 символов').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'Некорректный токен'),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(128),
  newPassword: z.string().min(8, 'Новый пароль — минимум 8 символов').max(128),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface AuthUser {
  id: string;
  login: string;
  fullName: string;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}
