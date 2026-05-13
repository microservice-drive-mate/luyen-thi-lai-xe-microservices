import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '../../types/user-role.enum';

export class ChangeRoleRequestDto {
  @ApiProperty({ enum: UserRole, example: UserRole.INSTRUCTOR })
  @IsEnum(UserRole)
  role!: UserRole;
}
