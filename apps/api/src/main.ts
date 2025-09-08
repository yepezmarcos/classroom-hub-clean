import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ✅ Use Nest's built-in CORS
  app.enableCors({ origin: true, credentials: true });

  // Larger payloads (comments bank / seeding safety)
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ limit: '2mb', extended: true }));

  // Keep the public API under /api (your web proxy expects this)
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port}/api`);
}
bootstrap();