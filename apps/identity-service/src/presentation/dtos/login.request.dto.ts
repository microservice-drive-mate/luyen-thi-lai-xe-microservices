import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 'admin@test.com' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
