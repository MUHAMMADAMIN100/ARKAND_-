import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionRepository } from './production.repository';
import { ProductionService } from './production.service';

@Module({
  controllers: [ProductionController],
  providers: [ProductionService, ProductionRepository],
})
export class ProductionModule {}
