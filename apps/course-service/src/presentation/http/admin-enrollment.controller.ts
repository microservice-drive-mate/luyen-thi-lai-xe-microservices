import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'nest-keycloak-connect';
import { ListAdminStudentEnrollmentsQuery } from '../../application/use-cases/list-admin-student-enrollments/list-admin-student-enrollments.query';
import { ListAdminStudentEnrollmentsUseCase } from '../../application/use-cases/list-admin-student-enrollments/list-admin-student-enrollments.use-case';
import { ListAdminEnrollmentsResponseDto } from '../dtos/admin-enrollment.response.dto';
import { AdminListEnrollmentsQueryDto } from '../dtos/admin-list-enrollments.query.dto';

@ApiTags('Admin Enrollments')
@ApiBearerAuth()
@Controller('admin/enrollments')
export class AdminEnrollmentController {
  constructor(
    private readonly listAdminStudentEnrollmentsUseCase: ListAdminStudentEnrollmentsUseCase,
  ) {}

  @Get()
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiOperation({ summary: 'List enrollments for a student with course data' })
  async listStudentEnrollments(
    @Query() query: AdminListEnrollmentsQueryDto,
  ): Promise<ListAdminEnrollmentsResponseDto> {
    const result = await this.listAdminStudentEnrollmentsUseCase.execute(
      new ListAdminStudentEnrollmentsQuery(
        query.studentId,
        query.page ?? 1,
        query.size ?? 100,
        query.status,
      ),
    );
    return ListAdminEnrollmentsResponseDto.fromResult(result);
  }
}
