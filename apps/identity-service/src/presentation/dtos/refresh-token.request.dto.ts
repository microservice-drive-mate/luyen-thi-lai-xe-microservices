import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenRequestDto {
  @ApiProperty({ description: 'Refresh token nhận được từ /login' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
