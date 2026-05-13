import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'You have been logged out successfully.' })
  message!: string;

  @ApiProperty({
    example: 'Please delete your token from LocalStorage or Cookie',
  })
  instruction!: string;
}
