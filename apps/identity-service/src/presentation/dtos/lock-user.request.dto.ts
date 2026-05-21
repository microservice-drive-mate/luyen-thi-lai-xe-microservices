import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class LockUserRequestDto {
  @ApiProperty({
    description: 'true = khóa tài khoản, false = mở khóa',
    example: true,
  })
  @IsBoolean()
  locked!: boolean;
}
