import { Test, TestingModule } from '@nestjs/testing';
import { MessagingController } from './messaging.controller';
import { SendWelcomeEmailUseCase } from '../../application/use-cases/send-welcome-email/send-welcome-email.use-case';
import { SendExamResultUseCase } from '../../application/use-cases/send-exam-result/send-exam-result.use-case';
import { SendAcademicWarningUseCase } from '../../application/use-cases/send-academic-warning/send-academic-warning.use-case';
import { SendPasswordResetUseCase } from '../../application/use-cases/send-password-reset/send-password-reset.use-case';
import { SendCourseUpdateUseCase } from '../../application/use-cases/send-course-update/send-course-update.use-case';
import { NotificationMetrics } from '../../infrastructure/metrics/notification.metrics';

describe('MessagingController', () => {
  let controller: MessagingController;

  const mockSendWelcomeEmailUseCase = { execute: jest.fn() };
  const mockSendExamResultUseCase = { execute: jest.fn() };
  const mockSendAcademicWarningUseCase = { execute: jest.fn() };
  const mockSendPasswordResetUseCase = { execute: jest.fn() };
  const mockSendCourseUpdateUseCase = { execute: jest.fn() };
  const mockMetrics = { recordConsumed: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        {
          provide: SendWelcomeEmailUseCase,
          useValue: mockSendWelcomeEmailUseCase,
        },
        { provide: SendExamResultUseCase, useValue: mockSendExamResultUseCase },
        {
          provide: SendAcademicWarningUseCase,
          useValue: mockSendAcademicWarningUseCase,
        },
        {
          provide: SendPasswordResetUseCase,
          useValue: mockSendPasswordResetUseCase,
        },
        {
          provide: SendCourseUpdateUseCase,
          useValue: mockSendCourseUpdateUseCase,
        },
        { provide: NotificationMetrics, useValue: mockMetrics },
      ],
    }).compile();

    controller = module.get<MessagingController>(MessagingController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleUserCreated', () => {
    it('should execute sendWelcomeEmailUseCase when valid payload is received', async () => {
      const payload = {
        userId: 'user-1',
        email: 'test@test.com',
        fullName: 'Test User',
      };

      await controller.handleUserCreated(payload);

      expect(mockMetrics.recordConsumed).toHaveBeenCalledWith(
        'identity.user.created',
      );
      expect(mockSendWelcomeEmailUseCase.execute).toHaveBeenCalled();
    });

    it('should ignore event when userId or email is missing', async () => {
      const payload = { userId: '', email: '' };

      await controller.handleUserCreated(payload);

      expect(mockMetrics.recordConsumed).toHaveBeenCalledWith(
        'identity.user.created',
      );
      expect(mockSendWelcomeEmailUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
