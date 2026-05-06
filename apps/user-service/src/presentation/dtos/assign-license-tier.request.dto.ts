import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { LicenseTier } from '../../domain/aggregates/user-profile/user-profile.types';

export class AssignLicenseTierRequestDto {
  @ApiProperty({ enum: LicenseTier })
  @IsEnum(LicenseTier)
  licenseTier: LicenseTier;
}
