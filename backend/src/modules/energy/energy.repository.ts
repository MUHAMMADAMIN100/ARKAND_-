import { Injectable } from '@nestjs/common';
import { Prisma, type ElectricityLog } from '@prisma/client';
import { KyselyService, TransactionHost, decToNum } from '../../common';
import type { ElectricityLogWithRelations } from './energy.mapper';
import { toMonthKey } from './energy.mapper';

const ELECTRICITY_LOG_INCLUDE = {
  byUser: { select: { fullName: true } },
} satisfies Prisma.ElectricityLogInclude;

export interface CreateElectricityLogData {
  month: Date;
  kwh: Prisma.Decimal;
  cost: Prisma.Decimal;
  note: string | null;
  byUserId: string;
}

export interface UpdateElectricityLogData {
  month?: Date;
  kwh?: Prisma.Decimal;
  cost?: Prisma.Decimal;
  note?: string | null;
}

@Injectable()
export class EnergyRepository {
  constructor(
    private readonly txHost: TransactionHost,
    private readonly kysely: KyselyService,
  ) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  findAll(): Promise<ElectricityLogWithRelations[]> {
    return this.db.electricityLog.findMany({
      include: ELECTRICITY_LOG_INCLUDE,
      orderBy: { month: 'desc' },
    });
  }

  findById(id: string): Promise<ElectricityLogWithRelations | null> {
    return this.db.electricityLog.findUnique({ where: { id }, include: ELECTRICITY_LOG_INCLUDE });
  }

  findByMonth(month: Date): Promise<ElectricityLog | null> {
    return this.db.electricityLog.findUnique({ where: { month } });
  }

  create(data: CreateElectricityLogData): Promise<ElectricityLogWithRelations> {
    return this.db.electricityLog.create({ data, include: ELECTRICITY_LOG_INCLUDE });
  }

  update(id: string, data: UpdateElectricityLogData): Promise<ElectricityLogWithRelations> {
    return this.db.electricityLog.update({ where: { id }, data, include: ELECTRICITY_LOG_INCLUDE });
  }

  async delete(id: string): Promise<void> {
    await this.db.electricityLog.delete({ where: { id } });
  }

  /**
   * Выпуск продукции по календарным месяцам (сумма production_outputs.quantity по сменам).
   * Агрегация (SUM+GROUP BY по дню смены) считается в БД через Kysely — раньше сюда
   * целиком вычитывались все смены и все строки выпуска за всю историю завода и
   * суммировались в JS на каждый запрос списка/создания/обновления записи об
   * электроэнергии; при росте истории производства это становилось всё медленнее.
   * Теперь по сети идёт лишь одна строка на календарный день, где были смены.
   */
  async monthlyOutputMap(): Promise<Map<string, number>> {
    const rows = await this.kysely
      .selectFrom('production_outputs as po')
      .innerJoin('production_shifts as ps', 'ps.id', 'po.shift_id')
      .groupBy('ps.date')
      .select(['ps.date as date', (eb) => eb.fn.sum<string | null>('po.quantity').as('total')])
      .execute();

    const map = new Map<string, number>();
    for (const row of rows) {
      const key = toMonthKey(row.date);
      map.set(key, (map.get(key) ?? 0) + decToNum(row.total));
    }
    return map;
  }
}
