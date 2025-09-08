import { Controller, Post } from '@nestjs/common';
import { seedDev } from './seed-dev';

@Controller('dev')
export class DevController {
  @Post('seed')
  async doSeed() {
    await seedDev();
    return { ok: true };
  }
}