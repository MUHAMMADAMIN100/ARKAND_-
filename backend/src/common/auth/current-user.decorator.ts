import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';

export interface RequestUser {
  id: string;
  login: string;
  role: Role;
  fullName: string;
}

/** @CurrentUser() — извлекает пользователя из request (проставляется JwtAuthGuard). */
export const CurrentUser = createParamDecorator((data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
  const user = request.user;
  if (!user) return undefined;
  return data ? user[data] : user;
});
