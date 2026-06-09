import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { ListNotificationsQuery } from '../../application/use-cases/list-notifications/list-notifications.query';
import { ListNotificationsUseCase } from '../../application/use-cases/list-notifications/list-notifications.use-case';
import { MarkNotificationReadCommand } from '../../application/use-cases/mark-notification-read/mark-notification-read.command';
import { MarkNotificationReadUseCase } from '../../application/use-cases/mark-notification-read/mark-notification-read.use-case';
import { QueueAcademicWarningsCommand } from '../../application/use-cases/queue-academic-warnings/queue-academic-warnings.command';
import { QueueAcademicWarningsUseCase } from '../../application/use-cases/queue-academic-warnings/queue-academic-warnings.use-case';
import { NotificationType } from '../../domain/repositories/notification.repository';
import {
  AcademicWarningAcceptedResponseDto,
  ListNotificationsQueryDto,
  ListNotificationsResponseDto,
  NotificationResponseDto,
  SendAcademicWarningRequestDto,
} from '../dtos/notification.dtos';

interface JwtPayload {
  sub?: string;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller()
export class NotificationController {
  constructor(
    private readonly listNotificationsUseCase: ListNotificationsUseCase,
    private readonly markNotificationReadUseCase: MarkNotificationReadUseCase,
    private readonly queueAcademicWarningsUseCase: QueueAcademicWarningsUseCase,
  ) {}

  @Post('admin/academic-warnings')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER', 'realm:INSTRUCTOR'] })
  @ApiOperation({
    summary: 'Queue academic warnings for asynchronous notification delivery.',
  })
  async sendAcademicWarning(
    @AuthenticatedUser() user: JwtPayload,
    @Body() dto: SendAcademicWarningRequestDto,
  ): Promise<AcademicWarningAcceptedResponseDto> {
    const studentIds = [
      ...(dto.studentId ? [dto.studentId] : []),
      ...(dto.studentIds ?? []),
    ].filter((value, index, items) => items.indexOf(value) === index);

    const result = await this.queueAcademicWarningsUseCase.execute(
      new QueueAcademicWarningsCommand(
        studentIds,
        dto.deliveryChannels ?? [NotificationType.IN_APP],
        dto.reason,
        dto.severity,
        dto.message,
        user.sub ?? '',
      ),
    );

    return {
      status: 'ACCEPTED',
      accepted: result.accepted,
      studentIds: result.studentIds,
      message:
        'Academic warning notifications were queued for asynchronous delivery.',
    };
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
      new ListNotificationsQuery(
        user.sub ?? '',
        query.page ?? 1,
        query.size ?? 20,
      ),
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
      new MarkNotificationReadCommand(id, user.sub ?? ''),
    );
    return NotificationResponseDto.fromRecord(result);
  }
}
