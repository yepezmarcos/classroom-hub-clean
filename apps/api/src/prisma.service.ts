import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Use Node's process hook instead of prisma.$on('beforeExit')
   * to avoid type errors across Prisma versions.
   */
  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      try { await this.$disconnect(); } catch {}
      try { await app.close(); } catch {}
    });
  }
}