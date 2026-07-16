import { Module } from '@nestjs/common';
import { WarehouseController } from './warehouse.controller';
import { WarehouseRepository } from './warehouse.repository';
import { WarehouseService } from './warehouse.service';

@Module({
  controllers: [WarehouseController],
  providers: [WarehouseService, WarehouseRepository],
})
export class WarehouseModule {}
