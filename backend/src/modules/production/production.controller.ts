import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  closeShiftSchema,
  dateStringSchema,
  openShiftSchema,
  recordOutputSchema,
  uuidSchema,
  type CloseShiftInput,
  type OpenShiftInput,
  type RecordOutputInput,
} from '@sheben/shared';
import { z } from 'zod';
import { ProductionService } from './production.service';
import { CurrentUser, Roles, ZBody, ZodQueryPipe, ZodValidationPipe } from '../../common';
import type { RequestUser } from '../../common';

const listShiftsQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
type ListShiftsQuery = z.infer<typeof listShiftsQuerySchema>;

/** Производственные смены и выпуск по фракциям. Ведут OPERATOR/ASSISTANT_OPERATOR; OWNER/ADMIN читают всё. */
@ApiTags('production')
@Controller('production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get('shifts')
  listShifts(@Query(new ZodQueryPipe(listShiftsQuerySchema)) query: ListShiftsQuery) {
    return this.production.listShifts(query);
  }

  @Get('shifts/:id')
  getShift(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
    return this.production.getShiftById(id);
  }

  @Post('shifts')
  @Roles('OPERATOR', 'ASSISTANT_OPERATOR')
  openShift(@ZBody(openShiftSchema) dto: OpenShiftInput, @CurrentUser() user: RequestUser) {
    return this.production.openShift(user, dto);
  }

  @Post('shifts/:id/output')
  @Roles('OPERATOR', 'ASSISTANT_OPERATOR')
  recordOutput(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @ZBody(recordOutputSchema) dto: RecordOutputInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.production.recordOutput(id, dto, user);
  }

  @Post('shifts/:id/close')
  @Roles('OPERATOR', 'ASSISTANT_OPERATOR')
  closeShift(@Param('id', new ZodValidationPipe(uuidSchema)) id: string, @ZBody(closeShiftSchema) dto: CloseShiftInput) {
    return this.production.closeShift(id, dto);
  }
}
