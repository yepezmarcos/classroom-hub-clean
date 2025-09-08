
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({ imports: [PrismaModule], controllers: [BillingController] })
export class BillingModule {}
