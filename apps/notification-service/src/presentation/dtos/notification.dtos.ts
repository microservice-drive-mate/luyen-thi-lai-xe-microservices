import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  NotificationRecord,
  NotificationStatus,
  NotificationType,
} from '../../domain/repositories/notification.repository';

export class SendAcademicWarningRequestDto {
  @ApiPropertyOptional({
    description: 'Single recipient id. Kept for backward compatibility.',
  })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Batch recipient ids for selected-student flow.',
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
    description:
      'Requested delivery channels. Admin API queues IN_APP warnings; EMAIL/PUSH are driven by event payload and service config.',
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

export class AcademicWarningAcceptedResponseDto {
  @ApiProperty({ example: 'ACCEPTED' })
  status!: string;

  @ApiProperty()
  accepted!: number;

  @ApiProperty({ type: [String] })
  studentIds!: string[];

  @ApiProperty({
    description:
      'Warnings were queued through RabbitMQ for asynchronous notification delivery.',
  })
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
  @ApiProperty({ nullable: true }) eventType!: string | null;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() data!: unknown;
  @ApiProperty({ enum: NotificationStatus }) status!: NotificationStatus;
  @ApiProperty() retryCount!: number;
  @ApiProperty({ nullable: true }) errorMessage!: string | null;
  @ApiProperty() isRead!: boolean;
  @ApiProperty({ nullable: true }) readAt!: Date | null;
  @ApiProperty({ nullable: true }) sentAt!: Date | null;
  @ApiProperty({ nullable: true }) deliveredAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  static fromRecord(record: NotificationRecord): NotificationResponseDto {
    return Object.assign(new NotificationResponseDto(), record);
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

export class MarkAllNotificationsReadResponseDto {
  @ApiProperty()
  updated!: number;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty() userId!: string;
  @ApiProperty() inAppEnabled!: boolean;
  @ApiProperty() emailEnabled!: boolean;
  @ApiProperty() pushEnabled!: boolean;
  @ApiProperty() smsEnabled!: boolean;
  @ApiProperty() studyReminderEnabled!: boolean;
  @ApiProperty() examReminderEnabled!: boolean;
  @ApiProperty() courseUpdateEnabled!: boolean;
  @ApiProperty() academicWarningEnabled!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class UpdateNotificationPreferencesRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  studyReminderEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  examReminderEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  courseUpdateEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  academicWarningEnabled?: boolean;
}
