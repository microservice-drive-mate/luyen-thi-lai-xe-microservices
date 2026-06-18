import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/identity-client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('database.url');
    const poolSize = configService.get<number>('database.poolSize') ?? 10;
    const connectionTimeoutMs =
      configService.get<number>('database.connectionTimeout') ?? 5000;
    super({
      adapter: new PrismaPg({
        connectionString,
        max: poolSize,
        connectionTimeoutMillis: connectionTimeoutMs,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private async connectWithRetry(): Promise<void> {
    const maxAttempts = 10;
    const delayMs = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        this.logger.warn(
          `Prisma connection attempt ${attempt}/${maxAttempts} failed. Retrying in ${delayMs}ms.`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
