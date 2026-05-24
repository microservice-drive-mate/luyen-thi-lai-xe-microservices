import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '../../domain/aggregates/identity-user/identity-user.types';

export class ChangeRoleRequestDto {
  @ApiProperty({ enum: UserRole, example: UserRole.INSTRUCTOR })
  @IsEnum(UserRole)
  role!: UserRole;
}
