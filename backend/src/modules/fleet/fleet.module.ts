import { Module } from '@nestjs/common';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { FleetRepository } from './fleet.repository';

@Module({
  controllers: [FleetController],
  providers: [FleetService, FleetRepository],
})
export class FleetModule {}
