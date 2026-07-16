import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET минимум 32 символа'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET минимум 32 символа'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  REDIS_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  THROTTLE_TTL: z.coerce.number().int().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().default(200),
});

export type AppConfig = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppConfig {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Некорректные переменные окружения:\n${issues}`);
  }
  return parsed.data;
}
