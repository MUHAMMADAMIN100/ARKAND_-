import { Module } from '@nestjs/common';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { CashRepository } from './cash.repository';
import { DebtRegistryController } from './debt-registry.controller';
import { DebtRegistryService } from './debt-registry.service';
import { DebtRegistryRepository } from './debt-registry.repository';

@Module({
  controllers: [CashController, DebtRegistryController],
  providers: [CashService, CashRepository, DebtRegistryService, DebtRegistryRepository],
})
export class FinanceModule {}
