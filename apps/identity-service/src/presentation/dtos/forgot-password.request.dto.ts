import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordRequestDto {
  @ApiProperty({ example: 'student1@gm.uit.edu.vn' })
  @IsEmail()
  email!: string;
}
