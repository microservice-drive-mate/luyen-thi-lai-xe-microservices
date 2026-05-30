import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetryAcademicWarningsUseCase } from '../../application/use-cases/notification.use-cases';

@Injectable()
export class AcademicWarningRetryService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AcademicWarningRetryService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly retryUseCase: RetryAcademicWarningsUseCase,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const intervalMs =
      this.configService.get<number>('notification.warningRetryIntervalMs') ??
      300_000;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    try {
      const count = await this.retryUseCase.execute();
      if (count > 0) {
        this.logger.log(`Retried ${count} academic warning notifications`);
      }
    } catch (error) {
      this.logger.error(
        `Academic warning retry failed: ${(error as Error).message}`,
      );
    }
  }
}
