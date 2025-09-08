import { Module } from '@nestjs/common';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [RosterController],
    providers: [RosterService, PrismaService],
})
export class RosterModule {}