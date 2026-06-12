import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';

export interface BackfillAdminDashboardCommand {
  source?: 'user' | 'course' | 'exam' | 'audit' | 'all';
}

@Injectable()
export class BackfillAdminDashboardUseCase
  implements IUseCase<BackfillAdminDashboardCommand, void>
{
  async execute(_command: BackfillAdminDashboardCommand): Promise<void> {
    // Owner-service exporters will publish replayable dashboard events in a
    // later phase; realtime projection uses the same event path.
  }
}
