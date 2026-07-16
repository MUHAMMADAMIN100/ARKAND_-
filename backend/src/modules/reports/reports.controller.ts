import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { reportPeriodSchema, type ReportPeriod } from '@sheben/shared';
import { CurrentUser, Roles, ZodQueryPipe, type RequestUser } from '../../common';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * Сводка для главного экрана — доступна всем ролям, но финансовые показатели
   * (доход/расход/долг) видны только управленческим/финансовым ролям (см. сервис).
   */
  @Get('dashboard')
  dashboard(@CurrentUser() user: RequestUser) {
    return this.reports.getDashboard(user.role);
  }

  /** ЩЕБ-70: выпуск/отгрузка/остаток по фракциям за период. */
  @Roles('OWNER', 'ADMIN')
  @Get('production')
  production(@Query(new ZodQueryPipe(reportPeriodSchema)) period: ReportPeriod) {
    return this.reports.getProductionReport(period);
  }

  /** ЩЕБ-71/ЩЕБ-32: солярка, электроэнергия, мощность за период. */
  @Roles('OWNER', 'ADMIN')
  @Get('resources')
  resources(@Query(new ZodQueryPipe(reportPeriodSchema)) period: ReportPeriod) {
    return this.reports.getResourcesReport(period);
  }

  /** ЩЕБ-72/ЩЕБ-33: деньги и себестоимость единицы за период. */
  @Roles('OWNER', 'ADMIN')
  @Get('finance')
  finance(@Query(new ZodQueryPipe(reportPeriodSchema)) period: ReportPeriod) {
    return this.reports.getFinanceReport(period);
  }
}
