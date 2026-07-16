import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createElectricityLogSchema,
  updateElectricityLogSchema,
  type CreateElectricityLogInput,
  type ElectricityLogDto,
  type UpdateElectricityLogInput,
} from '@sheben/shared';
import { CurrentUser, Roles, ZBody, type RequestUser } from '../../common';
import { EnergyService } from './energy.service';

@ApiTags('energy')
@Controller('energy')
export class EnergyController {
  constructor(private readonly energy: EnergyService) {}

  @Get()
  list(): Promise<ElectricityLogDto[]> {
    return this.energy.list();
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'OPERATOR')
  create(
    @ZBody(createElectricityLogSchema) dto: CreateElectricityLogInput,
    @CurrentUser() user: RequestUser,
  ): Promise<ElectricityLogDto> {
    return this.energy.create(dto, user.id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'OPERATOR')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateElectricityLogSchema) dto: UpdateElectricityLogInput,
  ): Promise<ElectricityLogDto> {
    return this.energy.update(id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN', 'OPERATOR')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ ok: true }> {
    await this.energy.remove(id);
    return { ok: true };
  }
}
