import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventPublisher } from './application/ports/event-publisher.port';
import { QuestionPoolClient } from './application/ports/question-pool.client';
import { UserProfileClient } from './application/ports/user-profile.client';
import { CreateTemplateUseCase } from './application/use-cases/create-template/create-template.use-case';
import { DeleteTemplateUseCase } from './application/use-cases/delete-template/delete-template.use-case';
import { GetSessionQuestionsUseCase } from './application/use-cases/get-session-questions/get-session-questions.use-case';
import { GetSessionResultUseCase } from './application/use-cases/get-session-result/get-session-result.use-case';
import { GetTemplateUseCase } from './application/use-cases/get-template/get-template.use-case';
import { ListSessionsUseCase } from './application/use-cases/list-sessions/list-sessions.use-case';
import { ListTemplatesUseCase } from './application/use-cases/list-templates/list-templates.use-case';
import { SaveAnswerUseCase } from './application/use-cases/save-answer/save-answer.use-case';
import { StartSessionUseCase } from './application/use-cases/start-session/start-session.use-case';
import { SubmitSessionUseCase } from './application/use-cases/submit-session/submit-session.use-case';
import { UpdateTemplateUseCase } from './application/use-cases/update-template/update-template.use-case';
import { ExamSessionRepository } from './domain/repositories/exam-session.repository';
import { ExamTemplateRepository } from './domain/repositories/exam-template.repository';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';
import { HttpQuestionPoolClient } from './infrastructure/http/http-question-pool.client';
import { HttpUserProfileClient } from './infrastructure/http/http-user-profile.client';
import { KeycloakTokenService } from './infrastructure/http/keycloak-token.service';
import {
  ANALYTICS_SERVICE_CLIENT,
  NOTIFICATION_SERVICE_CLIENT,
  RABBITMQ_CLIENT,
  RabbitMqEventPublisher,
} from './infrastructure/messaging/rabbitmq-event-publisher.service';
import { PrismaExamSessionRepository } from './infrastructure/persistence/prisma/prisma-exam-session.repository';
import { PrismaExamTemplateRepository } from './infrastructure/persistence/prisma/prisma-exam-template.repository';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { ExamSessionController } from './presentation/http/exam-session.controller';
import { ExamTemplateController } from './presentation/http/exam-template.controller';

const rmqClientFactory = (queue: string) => ({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    transport: Transport.RMQ as const,
    options: {
      urls: [config.get<string>('rabbitmq.url') ?? 'amqp://127.0.0.1:5672'],
      queue,
      queueOptions: { durable: true },
    },
  }),
});

@Module({
  imports: [
    ClientsModule.registerAsync([
      { name: RABBITMQ_CLIENT, ...rmqClientFactory('exam_service_publish') },
      {
        name: ANALYTICS_SERVICE_CLIENT,
        ...rmqClientFactory('analytics_service_events'),
      },
      {
        name: NOTIFICATION_SERVICE_CLIENT,
        ...rmqClientFactory('notification_service_events'),
      },
    ]),
  ],
  controllers: [ExamTemplateController, ExamSessionController],
  providers: [
    PrismaService,
    DomainExceptionFilter,
    KeycloakTokenService,
    { provide: ExamTemplateRepository, useClass: PrismaExamTemplateRepository },
    { provide: ExamSessionRepository, useClass: PrismaExamSessionRepository },
    { provide: EventPublisher, useClass: RabbitMqEventPublisher },
    { provide: QuestionPoolClient, useClass: HttpQuestionPoolClient },
    { provide: UserProfileClient, useClass: HttpUserProfileClient },
    CreateTemplateUseCase,
    UpdateTemplateUseCase,
    DeleteTemplateUseCase,
    GetTemplateUseCase,
    ListTemplatesUseCase,
    StartSessionUseCase,
    SaveAnswerUseCase,
    SubmitSessionUseCase,
    GetSessionQuestionsUseCase,
    GetSessionResultUseCase,
    ListSessionsUseCase,
  ],
})
export class ExamModule {}
