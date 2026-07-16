import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { loginSchema, refreshSchema, type LoginInput, type RefreshInput } from '@sheben/shared';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { ZBody } from '../../common/zod/zod-body.decorator';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser, type RequestUser } from '../../common/auth/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Строгий лимит на подбор пароля/токена: 10 попыток в минуту на IP (сверх глобального лимита).
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@ZBody(loginSchema) dto: LoginInput, @Req() req: Request) {
    return this.auth.login(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@ZBody(refreshSchema) dto: RefreshInput, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@ZBody(refreshSchema) dto: RefreshInput) {
    await this.auth.logout(dto.refreshToken);
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }
}
