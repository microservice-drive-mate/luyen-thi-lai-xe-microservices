import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { GetProgressQuery } from '../../application/use-cases/get-progress/get-progress.query';
import { GetProgressUseCase } from '../../application/use-cases/get-progress/get-progress.use-case';
import { ProgressResponseDto } from '../dtos/progress.response.dto';

interface JwtPayload {
  sub?: string;
  licenseTier?: string;
  license_category?: string;
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
