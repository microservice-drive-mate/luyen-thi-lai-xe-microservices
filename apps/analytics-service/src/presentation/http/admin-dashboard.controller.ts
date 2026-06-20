import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'nest-keycloak-connect';
import { GetAdminDashboardQuery } from '../../application/use-cases/get-admin-dashboard/get-admin-dashboard.query';
import { GetAdminDashboardUseCase } from '../../application/use-cases/get-admin-dashboard/get-admin-dashboard.use-case';
import { RecordLearningEventUseCase } from '../../application/use-cases/record-events/record-events.use-case';
import { DeleteStudentProfileUseCase } from '../../application/use-cases/delete-student-profile/delete-student-profile.use-case';
import { DeleteStudentProfileCommand } from '../../application/use-cases/delete-student-profile/delete-student-profile.command';
import { AdminDashboardResponseDto } from '../dtos/admin-dashboard.response.dto';

class CreateStudentProfileDto {
  studentId: string;
}

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
export class AdminDashboardController {
  constructor(
    private readonly getAdminDashboardUseCase: GetAdminDashboardUseCase,
    private readonly recordLearningEventUseCase: RecordLearningEventUseCase,
    private readonly deleteStudentProfileUseCase: DeleteStudentProfileUseCase,
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

  @Post('students')
  @Roles({ roles: ['realm:ADMIN'] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create student learning profile' })
  async createStudentProfile(
    @Body() dto: CreateStudentProfileDto,
  ): Promise<void> {
    await this.recordLearningEventUseCase.execute({
      type: 'student-created',
      studentId: dto.studentId,
    });
  }

  @Delete('students/:studentId')
  @Roles({ roles: ['realm:ADMIN'] })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete student learning profile (Saga Rollback)' })
  async deleteStudentProfile(
    @Param('studentId') studentId: string,
  ): Promise<void> {
    await this.deleteStudentProfileUseCase.execute(
      new DeleteStudentProfileCommand(studentId),
    );
  }
}
