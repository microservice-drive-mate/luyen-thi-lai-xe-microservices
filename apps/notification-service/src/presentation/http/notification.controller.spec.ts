import { Test, TestingModule } from '@nestjs/testing';
import { GetNotificationPreferencesUseCase } from '../../application/use-cases/get-notification-preferences/get-notification-preferences.use-case';
import { ListNotificationsUseCase } from '../../application/use-cases/list-notifications/list-notifications.use-case';
import { MarkAllNotificationsReadUseCase } from '../../application/use-cases/mark-all-notifications-read/mark-all-notifications-read.use-case';
import { MarkNotificationReadUseCase } from '../../application/use-cases/mark-notification-read/mark-notification-read.use-case';
import { QueueAcademicWarningsUseCase } from '../../application/use-cases/queue-academic-warnings/queue-academic-warnings.use-case';
import { UpdateNotificationPreferencesUseCase } from '../../application/use-cases/update-notification-preferences/update-notification-preferences.use-case';
import { NotificationController } from './notification.controller';

describe('NotificationController', () => {
  let controller: NotificationController;

  const mockListNotificationsUseCase = { execute: jest.fn() };
  const mockMarkNotificationReadUseCase = { execute: jest.fn() };
  const mockMarkAllNotificationsReadUseCase = { execute: jest.fn() };
  const mockGetNotificationPreferencesUseCase = { execute: jest.fn() };
  const mockUpdateNotificationPreferencesUseCase = { execute: jest.fn() };
  const mockQueueAcademicWarningsUseCase = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: ListNotificationsUseCase,
          useValue: mockListNotificationsUseCase,
        },
        {
          provide: MarkNotificationReadUseCase,
          useValue: mockMarkNotificationReadUseCase,
        },
        {
          provide: MarkAllNotificationsReadUseCase,
          useValue: mockMarkAllNotificationsReadUseCase,
        },
        {
          provide: GetNotificationPreferencesUseCase,
          useValue: mockGetNotificationPreferencesUseCase,
        },
        {
          provide: UpdateNotificationPreferencesUseCase,
          useValue: mockUpdateNotificationPreferencesUseCase,
        },
        {
          provide: QueueAcademicWarningsUseCase,
          useValue: mockQueueAcademicWarningsUseCase,
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listMine', () => {
    it('should call listNotificationsUseCase and return mapped result', async () => {
      const mockResult = {
        items: [{ id: 'notif-1', title: 'Test', read: false }],
        total: 1,
        page: 1,
        size: 20,
        totalPages: 1,
      };
      mockListNotificationsUseCase.execute.mockResolvedValue(mockResult);

      const response = await controller.listMine(
        { sub: 'user-1' },
        { page: 1, size: 20 },
      );
      expect(mockListNotificationsUseCase.execute).toHaveBeenCalled();
      expect(response.items.length).toBe(1);
    });
  });
});
