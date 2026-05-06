import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class LockUserRequestDto {
  @ApiProperty({
    description: 'true = lock (deactivate), false = unlock (activate)',
  })
  @IsBoolean()
  lock: boolean;
}
