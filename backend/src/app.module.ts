import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/configuration';

// Инфраструктура
import { PrismaModule } from './common/prisma/prisma.module';
import { StockModule } from './common/stock/stock.module';
import { AuditModule } from './common/audit/audit.module';
import { DebtModule } from './common/finance/debt.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { JwtModule } from '@nestjs/jwt';

// Домены
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ClientsModule } from './modules/clients/clients.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductionModule } from './modules/production/production.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { EnergyModule } from './modules/energy/energy.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } },
        autoLogging: true,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: Number(process.env.THROTTLE_TTL ?? 60_000),
          limit: Number(process.env.THROTTLE_LIMIT ?? 200),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    JwtModule.register({ global: true }),

    // Глобальная инфраструктура
    PrismaModule,
    StockModule,
    AuditModule,
    DebtModule,

    // Домены
    AuthModule,
    HealthModule,
    UsersModule,
    CatalogModule,
    ClientsModule,
    WarehouseModule,
    OrdersModule,
    ProductionModule,
    ShipmentsModule,
    FleetModule,
    EnergyModule,
    FinanceModule,
    ProcurementModule,
    InventoryModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
