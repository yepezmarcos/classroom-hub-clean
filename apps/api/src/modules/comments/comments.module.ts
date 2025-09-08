import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommentsExtraController } from './comments.extra.controller';
import { CommentsListController } from './comments.list.controller';

@Module({
  controllers: [CommentsExtraController, CommentsListController],
  providers: [PrismaService],
})
export class CommentsModule {}