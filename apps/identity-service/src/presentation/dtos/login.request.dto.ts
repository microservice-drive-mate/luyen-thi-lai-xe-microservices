import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 'admin@test.com' })
  @IsString()
  @IsNotEmpty({ message: 'Please enter email and password. (MSG01)' })
  username!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'Please enter email and password. (MSG01)' })
  password!: string;
}
