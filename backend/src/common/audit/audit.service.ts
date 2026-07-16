import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: unknown;
  ip?: string | null;
}

/** Append-only аудит важных операций. Ошибки записи не роняют бизнес-операцию. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          payload: (input.payload ?? undefined) as never,
          ip: input.ip ?? null,
        },
      });
    } catch (e) {
      this.logger.warn(`Не удалось записать audit-лог: ${(e as Error).message}`);
    }
  }
}
