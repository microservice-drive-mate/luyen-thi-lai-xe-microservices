import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { GetProgressQuery } from '../../application/use-cases/get-progress/get-progress.query';
import { GetProgressUseCase } from '../../application/use-cases/get-progress/get-progress.use-case';
import {
  ProgressResponseDto,
  StudyStreakResponseDto,
  WeakTopicsResponseDto,
} from '../dtos/progress.response.dto';

interface JwtPayload {
  sub?: string;
  licenseTier?: string;
  license_category?: string;
}

function toDateKey(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : new Date(value).toISOString().slice(0, 10);
}

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller()
export class AnalyticsController {
  constructor(private readonly getProgressUseCase: GetProgressUseCase) {}

  @Get('analytics/me/progress')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'View current student learning progress' })
  async getMyProgress(
    @AuthenticatedUser() user: JwtPayload,
  ): Promise<ProgressResponseDto> {
    const result = await this.getProgressUseCase.execute(
      new GetProgressQuery(
        user.sub ?? '',
        user.licenseTier ?? user.license_category,
      ),
    );
    return ProgressResponseDto.fromDashboard(result);
  }

  @Get('analytics/me/weak-topics')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'View current student weak topics' })
  async getMyWeakTopics(
    @AuthenticatedUser() user: JwtPayload,
  ): Promise<WeakTopicsResponseDto> {
    const result = await this.getProgressUseCase.execute(
      new GetProgressQuery(
        user.sub ?? '',
        user.licenseTier ?? user.license_category,
      ),
    );
    return { items: result.weakTopics };
  }

  @Get('analytics/me/study-streak')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'View current student study streak' })
  async getMyStudyStreak(
    @AuthenticatedUser() user: JwtPayload,
  ): Promise<StudyStreakResponseDto> {
    const result = await this.getProgressUseCase.execute(
      new GetProgressQuery(
        user.sub ?? '',
        user.licenseTier ?? user.license_category,
      ),
    );
    const activeDates = new Set(
      result.trend
        .filter(
          (item) =>
            item.attempts > 0 ||
            item.correctAnswers > 0 ||
            item.questionsAnswered > 0,
        )
        .map((item) => item.date),
    );

    const cursor = new Date();
    let currentStreakDays = 0;
    for (let index = 0; index < 30; index += 1) {
      const key = cursor.toISOString().slice(0, 10);
      if (!activeDates.has(key)) break;
      currentStreakDays += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return {
      currentStreakDays,
      longestWindowDays: activeDates.size,
      lastActivityDate: result.lastActivityAt
        ? toDateKey(result.lastActivityAt)
        : null,
    };
  }

  @Get('admin/analytics/students/:studentId/progress')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER', 'realm:INSTRUCTOR'] })
  @ApiOperation({
    summary: 'View a student learning progress for admin/instructor dashboard',
  })
  async getStudentProgress(
    @Param('studentId') studentId: string,
  ): Promise<ProgressResponseDto> {
    const result = await this.getProgressUseCase.execute(
      new GetProgressQuery(studentId),
    );
    return ProgressResponseDto.fromDashboard(result);
  }
}
