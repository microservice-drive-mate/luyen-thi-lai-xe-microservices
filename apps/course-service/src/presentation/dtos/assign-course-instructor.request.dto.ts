import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignCourseInstructorRequestDto {
  @ApiProperty()
  @IsUUID()
  instructorId: string;
}
