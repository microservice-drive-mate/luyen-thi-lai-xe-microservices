import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CourseStatus,
  LicenseCategory,
} from '../../domain/aggregates/course/course.types';
import {
  CourseMaterialResult,
  CourseRequirementResult,
  CourseResult,
  LessonResult,
  ListCoursesResult,
} from '../../application/use-cases/shared/course.result';

export class LessonResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() courseId: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() content: string | null;
  @ApiProperty() order: number;
  @ApiProperty() createdAt: Date;

  static fromResult(r: LessonResult): LessonResponseDto {
    const dto = new LessonResponseDto();
    Object.assign(dto, r);
    return dto;
  }
}

export class CourseRequirementResponseDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional() minAge: number | null;
  @ApiPropertyOptional() prerequisites: string | null;
  @ApiProperty() attendanceRate: number;
  @ApiProperty() minPassScore: number;
  @ApiProperty() requiredExams: number;

  static fromResult(r: CourseRequirementResult): CourseRequirementResponseDto {
    const dto = new CourseRequirementResponseDto();
    Object.assign(dto, r);
    return dto;
  }
}

export class CourseMaterialResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() fileUrl: string | null;
  @ApiPropertyOptional() mediaFileId: string | null;
  @ApiPropertyOptional() type: string | null;
  @ApiProperty() createdAt: Date;

  static fromResult(r: CourseMaterialResult): CourseMaterialResponseDto {
    const dto = new CourseMaterialResponseDto();
    Object.assign(dto, r);
    return dto;
  }
}

export class CourseResponseDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional() courseCode: string | null;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description: string | null;
  @ApiProperty({ enum: LicenseCategory }) licenseCategory: LicenseCategory;
  @ApiProperty() totalLessons: number;
  @ApiPropertyOptional() duration: string | null;
  @ApiProperty() tuitionFee: number;
  @ApiPropertyOptional() capacity: number | null;
  @ApiProperty({ enum: CourseStatus }) status: CourseStatus;
  @ApiProperty() version: number;
  @ApiProperty() isDeleted: boolean;
  @ApiPropertyOptional() deletedAt: Date | null;
  @ApiPropertyOptional() deletedBy: string | null;
  @ApiProperty() createdById: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: [LessonResponseDto] }) lessons: LessonResponseDto[];
  @ApiProperty({ type: [String] }) instructorIds: string[];
  @ApiPropertyOptional({ type: CourseRequirementResponseDto })
  requirement: CourseRequirementResponseDto | null;
  @ApiProperty({ type: [CourseMaterialResponseDto] })
  materials: CourseMaterialResponseDto[];

  static fromResult(result: CourseResult): CourseResponseDto {
    const dto = new CourseResponseDto();
    dto.id = result.id;
    dto.courseCode = result.courseCode;
    dto.title = result.title;
    dto.description = result.description;
    dto.licenseCategory = result.licenseCategory;
    dto.totalLessons = result.totalLessons;
    dto.duration = result.duration;
    dto.tuitionFee = result.tuitionFee;
    dto.capacity = result.capacity;
    dto.status = result.status;
    dto.version = result.version;
    dto.isDeleted = result.isDeleted;
    dto.deletedAt = result.deletedAt;
    dto.deletedBy = result.deletedBy;
    dto.createdById = result.createdById;
    dto.createdAt = result.createdAt;
    dto.updatedAt = result.updatedAt;
    dto.lessons = result.lessons.map(LessonResponseDto.fromResult);
    dto.instructorIds = result.instructorIds;
    dto.requirement = result.requirement
      ? CourseRequirementResponseDto.fromResult(result.requirement)
      : null;
    dto.materials = result.materials.map(CourseMaterialResponseDto.fromResult);
    return dto;
  }
}

export class ListCoursesResponseDto {
  @ApiProperty({ type: [CourseResponseDto] }) items: CourseResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() size: number;

  static fromResult(result: ListCoursesResult): ListCoursesResponseDto {
    const dto = new ListCoursesResponseDto();
    dto.items = result.items.map(CourseResponseDto.fromResult);
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}
