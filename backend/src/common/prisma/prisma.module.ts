import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TransactionHost } from './transaction';
import { KyselyService } from '../kysely/kysely.service';

@Global()
@Module({
  providers: [PrismaService, TransactionHost, KyselyService],
  exports: [PrismaService, TransactionHost, KyselyService],
})
export class PrismaModule {}
