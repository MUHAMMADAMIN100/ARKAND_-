import { Module } from '@nestjs/common';
import { EnergyController } from './energy.controller';
import { EnergyService } from './energy.service';
import { EnergyRepository } from './energy.repository';

@Module({
  controllers: [EnergyController],
  providers: [EnergyService, EnergyRepository],
})
export class EnergyModule {}
