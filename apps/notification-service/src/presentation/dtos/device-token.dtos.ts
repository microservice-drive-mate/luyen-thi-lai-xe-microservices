import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegisterDeviceTokenRequestDto {
  @ApiProperty({ description: 'Device token FCM/APNs của thiết bị' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ enum: ['ios', 'android'] })
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}

export class DeviceTokenResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() token!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  static fromRecord(record: DeviceTokenResponseDto): DeviceTokenResponseDto {
    const dto = new DeviceTokenResponseDto();
    dto.id = record.id;
    dto.userId = record.userId;
    dto.token = record.token;
    dto.platform = record.platform;
    dto.createdAt = record.createdAt;
    dto.updatedAt = record.updatedAt;
    return dto;
  }
}

export class UnregisterDeviceTokenParamsDto {
  @ApiProperty({ description: 'URL-encoded FCM registration token' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
