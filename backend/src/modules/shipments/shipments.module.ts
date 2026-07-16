import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsRepository } from './shipments.repository';
import { ShipmentsService } from './shipments.service';

@Module({
  controllers: [ShipmentsController],
  providers: [ShipmentsService, ShipmentsRepository],
})
export class ShipmentsModule {}
