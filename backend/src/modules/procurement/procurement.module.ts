import { Module } from '@nestjs/common';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { ProcurementRepository } from './procurement.repository';

@Module({
  controllers: [ProcurementController],
  providers: [ProcurementService, ProcurementRepository],
})
export class ProcurementModule {}
