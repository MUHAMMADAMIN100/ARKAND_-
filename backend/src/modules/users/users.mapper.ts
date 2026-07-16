import type { User } from '@prisma/client';
import type { UserDto } from '@sheben/shared';

/** User (Prisma) -> UserDto. passwordHash никогда не покидает бэкенд. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    login: user.login,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
