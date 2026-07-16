import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateElectricityLogInput, ElectricityLogDto, UpdateElectricityLogInput } from '@sheben/shared';
import { TransactionHost, numToDec } from '../../common';
import type { CreateElectricityLogData, UpdateElectricityLogData } from './energy.repository';
import { EnergyRepository } from './energy.repository';
import { toElectricityLogDto, toMonthKey, type ElectricityLogWithRelations } from './energy.mapper';

const MONTH_CONFLICT_MESSAGE = 'Запись за этот месяц уже существует';

/** Нормализует дату учёта к первому числу месяца (UTC-полночь). */
function normalizeMonth(dateStr: string): Date {
  const parsed = new Date(dateStr);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
}

function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

@Injectable()
export class EnergyService {
  constructor(
    private readonly repo: EnergyRepository,
    private readonly txHost: TransactionHost,
  ) {}

  async list(): Promise<ElectricityLogDto[]> {
    const [logs, outputMap] = await Promise.all([this.repo.findAll(), this.repo.monthlyOutputMap()]);
    return logs.map((log) => toElectricityLogDto(log, outputMap.get(toMonthKey(log.month)) ?? 0));
  }

  async create(input: CreateElectricityLogInput, byUserId: string): Promise<ElectricityLogDto> {
    const month = normalizeMonth(input.month);

    return this.txHost.run(async () => {
      const existing = await this.repo.findByMonth(month);
      if (existing) throw new ConflictException(MONTH_CONFLICT_MESSAGE);

      const created = await this.createSafely({
        month,
        kwh: numToDec(input.kwh),
        cost: numToDec(input.cost),
        note: input.note ?? null,
        byUserId,
      });

      const outputMap = await this.repo.monthlyOutputMap();
      return toElectricityLogDto(created, outputMap.get(toMonthKey(created.month)) ?? 0);
    });
  }

  async update(id: string, input: UpdateElectricityLogInput): Promise<ElectricityLogDto> {
    return this.txHost.run(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw new NotFoundException('Запись не найдена');

      const month = input.month !== undefined ? normalizeMonth(input.month) : undefined;
      if (month !== undefined && month.getTime() !== existing.month.getTime()) {
        const conflict = await this.repo.findByMonth(month);
        if (conflict) throw new ConflictException(MONTH_CONFLICT_MESSAGE);
      }

      const updated = await this.updateSafely(id, {
        ...(month !== undefined ? { month } : {}),
        ...(input.kwh !== undefined ? { kwh: numToDec(input.kwh) } : {}),
        ...(input.cost !== undefined ? { cost: numToDec(input.cost) } : {}),
        ...(input.note !== undefined ? { note: input.note ?? null } : {}),
      });

      const outputMap = await this.repo.monthlyOutputMap();
      return toElectricityLogDto(updated, outputMap.get(toMonthKey(updated.month)) ?? 0);
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Запись не найдена');
    await this.repo.delete(id);
  }

  /** create() с переводом ошибки уникальности месяца в понятный ConflictException. */
  private async createSafely(data: CreateElectricityLogData): Promise<ElectricityLogWithRelations> {
    try {
      return await this.repo.create(data);
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException(MONTH_CONFLICT_MESSAGE);
      throw e;
    }
  }

  /** update() с переводом ошибки уникальности месяца в понятный ConflictException. */
  private async updateSafely(id: string, data: UpdateElectricityLogData): Promise<ElectricityLogWithRelations> {
    try {
      return await this.repo.update(id, data);
    } catch (e) {
      if (isUniqueConstraintError(e)) throw new ConflictException(MONTH_CONFLICT_MESSAGE);
      throw e;
    }
  }
}
