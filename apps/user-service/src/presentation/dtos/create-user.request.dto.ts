import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  Gender,
  LicenseTier,
  UserRole,
} from '../../domain/aggregates/user-profile/user-profile.types';

export class CreateUserRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(0|\+84)[3-9]\d{8}$/, {
    message: 'Invalid Vietnamese phone number',
  })
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateOfBirth?: Date;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: LicenseTier })
  @IsOptional()
  @IsEnum(LicenseTier)
  licenseTier?: LicenseTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  enrolledAt?: Date;
}
