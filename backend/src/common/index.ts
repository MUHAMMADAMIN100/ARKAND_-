// Barrel общей инфраструктуры — единая точка импорта для доменных модулей.
export { PrismaService } from './prisma/prisma.service';
export { TransactionHost } from './prisma/transaction';
export { KyselyService } from './kysely/kysely.service';
export type { Database } from './kysely/db.types';
export { StockService } from './stock/stock.service';
export type { ApplyMovementInput } from './stock/stock.service';
export { AuditService } from './audit/audit.service';
export { DebtService } from './finance/debt.service';
export type { RecordDebtInput } from './finance/debt.service';

export { ZodValidationPipe } from './zod/zod-validation.pipe';
export { ZodQueryPipe } from './zod/zod-query.pipe';
export { ZBody } from './zod/zod-body.decorator';

export { CurrentUser } from './auth/current-user.decorator';
export type { RequestUser } from './auth/current-user.decorator';
export { Roles } from './auth/roles.decorator';
export { Public } from './auth/public.decorator';
export { JwtAuthGuard } from './auth/jwt-auth.guard';
export { RolesGuard } from './auth/roles.guard';

export { decToNum, numToDec, round2, round3 } from './utils/decimal';
export { startOfDayUtc, endOfDayUtc } from './utils/date';
export { buildPaginated, skipTake, decodeCursor, encodeCursor } from './repository/pagination';
