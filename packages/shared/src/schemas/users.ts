import { z } from 'zod';
import { Role } from '../enums';

export const createUserSchema = z.object({
  login: z
    .string()
    .min(3, 'Логин — минимум 3 символа')
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Логин: латиница, цифры, точка, дефис, подчёркивание'),
  password: z.string().min(8, 'Пароль — минимум 8 символов').max(128),
  fullName: z.string().min(2, 'Укажите ФИО').max(160),
  role: z.enum(Role),
  phone: z.string().max(32).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema
  .omit({ password: true, login: true })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Пароль — минимум 8 символов').max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export interface UserDto {
  id: string;
  login: string;
  fullName: string;
  role: Role;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}
