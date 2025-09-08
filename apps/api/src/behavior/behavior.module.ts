import { Module } from '@nestjs/common';
import { BehaviorController } from './behavior.controller';
import { BehaviorService } from './behavior.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [BehaviorController],
    providers: [BehaviorService, PrismaService],
})
export class BehaviorModule {}