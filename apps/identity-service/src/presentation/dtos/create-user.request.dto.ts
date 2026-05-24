import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../domain/aggregates/identity-user/identity-user.types';

export class CreateUserRequestDto {
  @ApiProperty({ example: 'nguyenvana@gm.uit.edu.vn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.STUDENT })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({
    example: 'Temp@1234',
    description: 'Mật khẩu tạm thời, user phải đổi khi đăng nhập lần đầu',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  temporaryPassword!: string;
}
