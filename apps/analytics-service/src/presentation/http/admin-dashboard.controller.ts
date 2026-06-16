import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'nest-keycloak-connect';
import { GetAdminDashboardQuery } from '../../application/use-cases/get-admin-dashboard/get-admin-dashboard.query';
import { GetAdminDashboardUseCase } from '../../application/use-cases/get-admin-dashboard/get-admin-dashboard.use-case';
import { AdminDashboardResponseDto } from '../dtos/admin-dashboard.response.dto';

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
export class AdminDashboardController {
  constructor(
    private readonly getAdminDashboardUseCase: GetAdminDashboardUseCase,
  ) {}

  @Get('dashboard')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiOperation({ summary: 'View admin dashboard reporting metrics' })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'Calendar month in YYYY-MM format',
    example: '2026-06',
  })
  async getDashboard(
    @Query('month') month?: string,
  ): Promise<AdminDashboardResponseDto> {
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException('month must match YYYY-MM');
    }

    const result = await this.getAdminDashboardUseCase.execute(
      new GetAdminDashboardQuery(month),
    );
    return AdminDashboardResponseDto.fromDashboard(result);
  }
}
