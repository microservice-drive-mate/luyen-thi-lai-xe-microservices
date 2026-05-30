import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { NotificationType } from '@prisma/notification-client';
import { NotificationRecord } from '../../domain/repositories/notification.repository';
import { AcademicWarningDispatchResult } from '../../application/use-cases/notification.use-cases';

export class SendAcademicWarningRequestDto {
  @ApiPropertyOptional({
    description: 'Single recipient id. Kept for backward compatibility.',
  })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Batch recipient ids for SRS UC29 selected-student flow.',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @ApiPropertyOptional({
    enum: NotificationType,
    isArray: true,
    default: [NotificationType.IN_APP],
    description: 'Delivery channels. Current implementation supports IN_APP.',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NotificationType, { each: true })
  deliveryChannels?: NotificationType[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({ example: 'HIGH' })
  @IsString()
  @IsNotEmpty()
  severity!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  size?: number = 20;
}

export class NotificationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ enum: NotificationType }) type!: NotificationType;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() data!: unknown;
  @ApiProperty() isRead!: boolean;
  @ApiProperty({ nullable: true }) readAt!: Date | null;
  @ApiProperty({ nullable: true }) sentAt!: Date | null;
  @ApiProperty() createdAt!: Date;

  static fromRecord(record: NotificationRecord): NotificationResponseDto {
    return Object.assign(new NotificationResponseDto(), record);
  }
}

export class AcademicWarningDispatchResponseDto {
  @ApiProperty() warningId!: string;
  @ApiProperty({ type: [String] }) warningIds!: string[];
  @ApiProperty({ nullable: true, type: NotificationResponseDto })
  notification!: NotificationResponseDto | null;
  @ApiProperty({ type: [NotificationResponseDto] })
  notifications!: NotificationResponseDto[];
  @ApiProperty() deliveryStatus!: string;
  @ApiProperty() persisted!: number;
  @ApiProperty() queued!: number;
  @ApiProperty() pendingRetry!: number;

  static fromResult(
    result: AcademicWarningDispatchResult,
  ): AcademicWarningDispatchResponseDto {
    const dto = new AcademicWarningDispatchResponseDto();
    dto.warningId = result.warningId;
    dto.warningIds = result.warningIds;
    dto.notification = result.notification
      ? NotificationResponseDto.fromRecord(result.notification)
      : null;
    dto.notifications = result.notifications.map(
      NotificationResponseDto.fromRecord,
    );
    dto.deliveryStatus = result.deliveryStatus;
    dto.persisted = result.persisted;
    dto.queued = result.queued;
    dto.pendingRetry = result.pendingRetry;
    return dto;
  }
}

export class ListNotificationsResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() size!: number;

  static fromResult(result: {
    items: NotificationRecord[];
    total: number;
    page: number;
    size: number;
  }): ListNotificationsResponseDto {
    const dto = new ListNotificationsResponseDto();
    dto.items = result.items.map(NotificationResponseDto.fromRecord);
    dto.total = result.total;
    dto.page = result.page;
    dto.size = result.size;
    return dto;
  }
}
