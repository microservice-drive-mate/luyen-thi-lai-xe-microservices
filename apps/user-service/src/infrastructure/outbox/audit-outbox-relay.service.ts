import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Prisma } from '@prisma/user-client';
import { lastValueFrom } from 'rxjs';
import { PrismaService } from '../persistence/prisma/prisma.service';

export const AUDIT_SERVICE_CLIENT = 'AUDIT_SERVICE_CLIENT';

@Injectable()
export class AuditOutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditOutboxRelayService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_SERVICE_CLIENT) private readonly auditClient: ClientProxy,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), 5000);
    void this.flush();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async flush(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const messages = await this.prisma.outboxMessage.findMany({
        where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      for (const message of messages) {
        try {
          await this.auditClient.connect();
          await lastValueFrom(
            this.auditClient.emit(
              message.eventName,
              message.payload as Prisma.JsonObject,
            ),
          );
          await this.prisma.outboxMessage.update({
            where: { id: message.id },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              lastError: null,
            },
          });
        } catch (error) {
          this.auditClient.close();
          const attempts = message.attempts + 1;
          await this.prisma.outboxMessage.update({
            where: { id: message.id },
            data: {
              attempts,
              status: attempts >= 10 ? 'FAILED' : 'PENDING',
              nextAttemptAt: new Date(
                Date.now() + Math.min(attempts * 10000, 300000),
              ),
              lastError: (error as Error).message,
            },
          });
          this.logger.error(
            `Failed to publish audit outbox ${message.id}: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Audit outbox relay skipped: ${(error as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }
}
