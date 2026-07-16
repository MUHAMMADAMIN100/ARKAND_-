import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';

/** Точный тип для expiresIn (ms.StringValue|number) — извлекаем из JwtSignOptions. */
type SignExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;
import type { LoginInput, LoginResponse, AuthTokens, AuthUser } from '@sheben/shared';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

interface TokenPayload {
  sub: string;
  login: string;
  role: AuthUser['role'];
  fullName: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Валидный 60-символьный bcrypt-хэш (cost 10) — для постоянного времени сравнения,
  // когда пользователь не найден. Битый хэш bcrypt отверг бы мгновенно (timing-оракул).
  private static readonly DUMMY_HASH = '$2b$10$TAmYfDWKUCrtj9jCb0RudustvpdUJn28gRK/w2xvdYkX9lQ/dNpkC';

  async login(dto: LoginInput, meta: { ip?: string; userAgent?: string }): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { login: dto.login } });
    // Постоянное время: сравниваем хэш даже если пользователь не найден (защита от user enumeration).
    const hash = user?.passwordHash ?? AuthService.DUMMY_HASH;
    const ok = await bcrypt.compare(dto.password, hash);
    if (!user || !user.isActive || !ok) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const authUser: AuthUser = { id: user.id, login: user.login, fullName: user.fullName, role: user.role };
    const tokens = await this.issueTokens(authUser);
    await this.persistRefreshToken(user.id, tokens.refreshToken, meta);
    return { ...tokens, user: authUser };
  }

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Сессия истекла, войдите заново');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Неверный тип токена');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) {
      throw new UnauthorizedException('Сессия недействительна');
    }
    // Reuse-detection: предъявлен уже отозванный (ротированный) токен → вероятная кража.
    // Отзываем ВСЕ активные сессии пользователя и требуем повторного входа.
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(`Повторное использование отозванного refresh-токена (userId=${stored.userId}) — все сессии отозваны`);
      throw new UnauthorizedException('Сессия скомпрометирована, войдите заново');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Сессия недействительна');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Пользователь неактивен');
    }

    // Ротация: старый refresh отзывается, выдаётся новая пара.
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const authUser: AuthUser = { id: user.id, login: user.login, fullName: user.fullName, role: user.role };
    const tokens = await this.issueTokens(authUser);
    await this.persistRefreshToken(user.id, tokens.refreshToken, meta);
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, login: user.login, fullName: user.fullName, role: user.role };
  }

  private async issueTokens(user: AuthUser): Promise<AuthTokens> {
    const base = { sub: user.id, login: user.login, role: user.role, fullName: user.fullName };
    // @types/jsonwebtoken типизирует expiresIn как StringValue|number (template literal),
    // из-за чего обычная строка из конфига не проходит. Приводим к ожидаемому типу ms.StringValue.
    const accessTtl = (this.config.get<string>('JWT_ACCESS_TTL') ?? '15m') as SignExpiresIn;
    const refreshTtl = (this.config.get<string>('JWT_REFRESH_TTL') ?? '30d') as SignExpiresIn;
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { ...base, type: 'access' },
        { secret: this.config.get<string>('JWT_ACCESS_SECRET'), expiresIn: accessTtl },
      ),
      this.jwt.signAsync(
        { ...base, type: 'refresh', jti: randomBytes(16).toString('hex') },
        { secret: this.config.get<string>('JWT_REFRESH_SECRET'), expiresIn: refreshTtl },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<void> {
    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 256) ?? null,
      },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
