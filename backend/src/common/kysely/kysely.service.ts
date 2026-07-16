import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './db.types';

/**
 * Kysely — только для сложной аналитики/отчётов (CTE, оконные функции, агрегаты).
 * Обычный CRUD идёт через Prisma. Отдельный пул на 10 соединений.
 */
@Injectable()
export class KyselyService extends Kysely<Database> implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const pool = new Pool({
      connectionString: config.get<string>('DATABASE_URL'),
      max: 10,
    });
    super({ dialect: new PostgresDialect({ pool }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.destroy();
  }
}
