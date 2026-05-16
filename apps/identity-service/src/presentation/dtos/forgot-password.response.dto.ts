import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    example:
      'If this email exists, password reset instructions have been sent.',
  })
  message!: string;
}
