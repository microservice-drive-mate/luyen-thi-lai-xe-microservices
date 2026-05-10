import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty()
  refreshExpiresIn: number;

  @ApiProperty()
  tokenType: string;

  @ApiPropertyOptional()
  scope?: string;
}
