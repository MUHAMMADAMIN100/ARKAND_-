import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** @Roles('OWNER','ADMIN') — ограничивает доступ к эндпоинту списком ролей. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
