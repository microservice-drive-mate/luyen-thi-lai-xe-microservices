import { ApiProperty } from '@nestjs/swagger';

export class PasswordActionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Password has been changed.' })
  message: string;

  static fromResult(result: {
    success: boolean;
    message: string;
  }): PasswordActionResponseDto {
    const dto = new PasswordActionResponseDto();
    dto.success = result.success;
    dto.message = result.message;
    return dto;
  }
}
