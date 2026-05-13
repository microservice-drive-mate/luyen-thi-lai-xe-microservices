import { ApiProperty } from '@nestjs/swagger';

export class LockUserResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  locked!: boolean;
}
