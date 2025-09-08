import { Module } from '@nestjs/common';
import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Module({
    controllers: [DigestController],
    providers: [DigestService, PrismaService, EmailService],
})
export class DigestModule {}