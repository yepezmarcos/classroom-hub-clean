import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);
  async onModuleInit() {
    this.logger.log('Bootstrap ready');
  }
}