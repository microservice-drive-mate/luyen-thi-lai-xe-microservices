import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { GetInstructorDashboardQuery } from '../../application/use-cases/get-instructor-dashboard/get-instructor-dashboard.query';
import { GetInstructorDashboardUseCase } from '../../application/use-cases/get-instructor-dashboard/get-instructor-dashboard.use-case';
import { InstructorDashboardResponseDto } from '../dtos/instructor-dashboard.response.dto';

interface JwtPayload {
  sub?: string;
}

@ApiTags('Instructor Analytics')
@ApiBearerAuth()
@Controller()
export class InstructorDashboardController {
  constructor(
    private readonly getInstructorDashboardUseCase: GetInstructorDashboardUseCase,
  ) {}

  @Get('analytics/instructor/dashboard')
  @Roles({ roles: ['realm:INSTRUCTOR'] })
  @ApiOperation({ summary: 'View current instructor dashboard metrics' })
  @ApiQuery({ name: 'month', required: false, example: '2026-06' })
  @ApiQuery({ name: 'weekStart', required: false, example: '2026-06-08' })
  @ApiQuery({ name: 'date', required: false, example: '2026-06-13' })
  async getMyDashboard(
    @AuthenticatedUser() user: JwtPayload,
    @Query('month') month?: string,
    @Query('weekStart') weekStart?: string,
    @Query('date') date?: string,
  ): Promise<InstructorDashboardResponseDto> {
    const result = await this.getInstructorDashboardUseCase.execute(
      new GetInstructorDashboardQuery(user.sub ?? '', month, weekStart, date),
    );
    return InstructorDashboardResponseDto.fromDashboard(result);
  }

  @Get('admin/analytics/instructors/:instructorId/dashboard')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiOperation({ summary: 'View an instructor dashboard for admin reporting' })
  @ApiQuery({ name: 'month', required: false, example: '2026-06' })
  @ApiQuery({ name: 'weekStart', required: false, example: '2026-06-08' })
  @ApiQuery({ name: 'date', required: false, example: '2026-06-13' })
  async getInstructorDashboard(
    @Param('instructorId') instructorId: string,
    @Query('month') month?: string,
    @Query('weekStart') weekStart?: string,
    @Query('date') date?: string,
  ): Promise<InstructorDashboardResponseDto> {
    const result = await this.getInstructorDashboardUseCase.execute(
      new GetInstructorDashboardQuery(instructorId, month, weekStart, date),
    );
    return InstructorDashboardResponseDto.fromDashboard(result);
  }
}
