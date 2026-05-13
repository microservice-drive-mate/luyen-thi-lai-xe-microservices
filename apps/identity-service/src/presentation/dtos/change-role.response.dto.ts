import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../types/user-role.enum';

export class ChangeRoleResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}
