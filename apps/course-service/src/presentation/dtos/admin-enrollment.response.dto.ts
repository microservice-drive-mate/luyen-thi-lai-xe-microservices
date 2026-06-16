import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnrollmentStatus } from '../../domain/aggregates/course-enrollment/course-enrollment.types';
import { LicenseCategory } from '../../domain/aggregates/course/course.types';
import {
  AdminStudentEnrollmentResult,
  ListAdminStudentEnrollmentsResult,
} from '../../application/use-cases/list-admin-student-enrollments/list-admin-student-enrollments.result';

export class AdminEnrollmentResponseDto {
  @ApiProperty() enrollmentId!: string;
  @ApiProperty() courseId!: string;
  @ApiPropertyOptional() courseCode!: string | null;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: LicenseCategory }) licenseCategory!: LicenseCategory;
  @ApiProperty({ enum: EnrollmentStatus }) status!: EnrollmentStatus;
  @ApiProperty() progress!: number;
  @ApiProperty() enrolledAt!: Date;
  @ApiPropertyOptional() completedAt!: Date | null;

  static fromResult(
    result: AdminStudentEnrollmentResult,
  ): AdminEnrollmentResponseDto {
    const dto = new AdminEnrollmentResponseDto();
    dto.enrollmentId = result.enrollmentId;
    dto.courseId = result.courseId;
    dto.courseCode = result.courseCode;
    dto.title = result.title;
    dto.licenseCategory = result.licenseCategory;
    dto.status = result.status;
    dto.progress = result.progress;
    dto.enrolledAt = result.enrolledAt;
    dto.completedAt = result.completedAt;
    return dto;
  }
}

export class ListAdminEnrollmentsResponseDto {
  @ApiProperty({ type: [AdminEnrollmentResponseDto] })
  items!: AdminEnrollmentResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() size!: number;

  static fromResult(
    result: ListAdminStudentEnrollmentsResult,
  ): ListAdminEnrollmentsResponseDto {
    const dto = new ListAdminEnrollmentsResponseDto();
    dto.items = result.items.map(AdminEnrollmentResponseDto.fromResult);
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}
