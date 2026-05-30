import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import {
  ListNotificationsUseCase,
  MarkNotificationReadUseCase,
  SendAcademicWarningUseCase,
} from '../../application/use-cases/notification.use-cases';
import {
  AcademicWarningDispatchResponseDto,
  ListNotificationsQueryDto,
  ListNotificationsResponseDto,
  NotificationResponseDto,
  SendAcademicWarningRequestDto,
} from '../dtos/notification.dtos';
import { NotificationType } from '@prisma/notification-client';

interface JwtPayload {
  sub?: string;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller()
export class NotificationController {
  constructor(
    private readonly sendAcademicWarningUseCase: SendAcademicWarningUseCase,
    private readonly listNotificationsUseCase: ListNotificationsUseCase,
    private readonly markNotificationReadUseCase: MarkNotificationReadUseCase,
  ) {}

  @Post('admin/academic-warnings')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER', 'realm:INSTRUCTOR'] })
  @ApiOperation({ summary: 'Send academic warning to a student' })
  async sendAcademicWarning(
    @AuthenticatedUser() user: JwtPayload,
    @Body() dto: SendAcademicWarningRequestDto,
  ): Promise<AcademicWarningDispatchResponseDto> {
    const studentIds = [
      ...(dto.studentId ? [dto.studentId] : []),
      ...(dto.studentIds ?? []),
    ].filter((value, index, items) => items.indexOf(value) === index);
    if (studentIds.length === 0) {
      throw new BadRequestException(
        'At least one student recipient is required',
      );
    }
    const unsupportedChannels = (
      dto.deliveryChannels ?? [NotificationType.IN_APP]
    ).filter((channel) => channel !== NotificationType.IN_APP);
    if (unsupportedChannels.length > 0) {
      throw new BadRequestException('Only IN_APP delivery is supported');
    }

    const result = await this.sendAcademicWarningUseCase.executeMany({
      studentIds,
      reason: dto.reason,
      severity: dto.severity,
      message: dto.message,
      createdById: user.sub ?? '',
    });
    return AcademicWarningDispatchResponseDto.fromResult(result);
  }

  @Get('notifications/me')
  @Roles({
    roles: [
      'realm:ADMIN',
      'realm:CENTER_MANAGER',
      'realm:INSTRUCTOR',
      'realm:STUDENT',
    ],
  })
  @ApiOperation({ summary: 'List current user notifications' })
  async listMine(
    @AuthenticatedUser() user: JwtPayload,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<ListNotificationsResponseDto> {
    const result = await this.listNotificationsUseCase.execute(
      user.sub ?? '',
      query.page ?? 1,
      query.size ?? 20,
    );
    return ListNotificationsResponseDto.fromResult(result);
  }

  @Patch('notifications/:id/read')
  @Roles({
    roles: [
      'realm:ADMIN',
      'realm:CENTER_MANAGER',
      'realm:INSTRUCTOR',
      'realm:STUDENT',
    ],
  })
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(
    @AuthenticatedUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    const result = await this.markNotificationReadUseCase.execute(
      id,
      user.sub ?? '',
    );
    return NotificationResponseDto.fromRecord(result);
  }
}
