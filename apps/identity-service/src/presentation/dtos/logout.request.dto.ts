import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutRequestDto {
  @ApiProperty({ description: 'Refresh token nhận được lúc login' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
