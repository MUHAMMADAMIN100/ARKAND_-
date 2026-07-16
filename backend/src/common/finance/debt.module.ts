import { Global, Module } from '@nestjs/common';
import { DebtService } from './debt.service';

@Global()
@Module({
  providers: [DebtService],
  exports: [DebtService],
})
export class DebtModule {}
