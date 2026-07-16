import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** @Public() — эндпоинт без авторизации (логин, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
