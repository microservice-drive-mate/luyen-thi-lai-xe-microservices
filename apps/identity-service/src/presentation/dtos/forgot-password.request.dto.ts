import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordRequestDto {
  @ApiProperty({ example: 'student1@gm.uit.edu.vn' })
  @IsNotEmpty({ message: 'Please enter a valid email address. (MSG04)' })
  @IsEmail({}, { message: 'Please enter a valid email address. (MSG04)' })
  email!: string;
}
