import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ContactsController],
})
export class ContactsModule {}