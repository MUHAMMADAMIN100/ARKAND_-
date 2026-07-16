import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createFuelLogSchema,
  createMaintenanceSchema,
  createTripSchema,
  createVehicleSchema,
  updateVehicleSchema,
  type CreateFuelLogInput,
  type CreateMaintenanceInput,
  type CreateTripInput,
  type CreateVehicleInput,
  type FuelLogDto,
  type MaintenanceDto,
  type Paginated,
  type TripDto,
  type UpdateVehicleInput,
  type VehicleDto,
} from '@sheben/shared';
import { CurrentUser, Roles, ZBody, ZodQueryPipe, type RequestUser } from '../../common';
import {
  fuelLogFilterSchema,
  maintenanceFilterSchema,
  tripFilterSchema,
  vehicleListFilterSchema,
  type FuelLogFilter,
  type MaintenanceFilter,
  type TripFilter,
  type VehicleListFilter,
} from './fleet.filters';
import { FleetService } from './fleet.service';

@ApiTags('fleet')
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  // ---------- Vehicles ----------

  @Get('vehicles')
  listVehicles(@Query(new ZodQueryPipe(vehicleListFilterSchema)) filter: VehicleListFilter): Promise<VehicleDto[]> {
    return this.fleet.listVehicles(filter);
  }

  @Post('vehicles')
  @Roles('OWNER', 'ADMIN', 'MECHANIC')
  createVehicle(@ZBody(createVehicleSchema) dto: CreateVehicleInput): Promise<VehicleDto> {
    return this.fleet.createVehicle(dto);
  }

  @Patch('vehicles/:id')
  @Roles('OWNER', 'ADMIN', 'MECHANIC')
  updateVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(updateVehicleSchema) dto: UpdateVehicleInput,
  ): Promise<VehicleDto> {
    return this.fleet.updateVehicle(id, dto);
  }

  @Delete('vehicles/:id')
  @Roles('OWNER', 'ADMIN', 'MECHANIC')
  deactivateVehicle(@Param('id', ParseUUIDPipe) id: string): Promise<VehicleDto> {
    return this.fleet.deactivateVehicle(id);
  }

  // ---------- Maintenance (ТО/ремонты) ----------

  @Get('maintenance')
  listMaintenance(
    @Query(new ZodQueryPipe(maintenanceFilterSchema)) filter: MaintenanceFilter,
  ): Promise<Paginated<MaintenanceDto>> {
    return this.fleet.listMaintenance(filter);
  }

  @Post('maintenance')
  @Roles('MECHANIC', 'OWNER', 'ADMIN')
  createMaintenance(
    @ZBody(createMaintenanceSchema) dto: CreateMaintenanceInput,
    @CurrentUser() user: RequestUser,
  ): Promise<MaintenanceDto> {
    return this.fleet.createMaintenance(dto, user.id);
  }

  // ---------- Fuel (солярка) ----------

  @Get('fuel')
  listFuelLogs(@Query(new ZodQueryPipe(fuelLogFilterSchema)) filter: FuelLogFilter): Promise<Paginated<FuelLogDto>> {
    return this.fleet.listFuelLogs(filter);
  }

  @Post('fuel')
  @Roles('OWNER', 'ADMIN', 'OPERATOR', 'MECHANIC', 'DUMP_TRUCK_DRIVER', 'EXCAVATOR_DRIVER')
  createFuelLog(@ZBody(createFuelLogSchema) dto: CreateFuelLogInput, @CurrentUser() user: RequestUser): Promise<FuelLogDto> {
    return this.fleet.createFuelLog(dto, user.id);
  }

  // ---------- Trips (рейсы) ----------

  @Get('trips')
  listTrips(
    @Query(new ZodQueryPipe(tripFilterSchema)) filter: TripFilter,
    @CurrentUser() user: RequestUser,
  ): Promise<Paginated<TripDto>> {
    return this.fleet.listTrips(filter, user);
  }

  @Post('trips')
  @Roles('OWNER', 'ADMIN', 'OPERATOR', 'DUMP_TRUCK_DRIVER', 'EXCAVATOR_DRIVER')
  createTrip(@ZBody(createTripSchema) dto: CreateTripInput, @CurrentUser() user: RequestUser): Promise<TripDto> {
    return this.fleet.createTrip(dto, user);
  }
}
