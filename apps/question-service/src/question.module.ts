import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { createRabbitMqClientOptions } from '@repo/common';
import { EventPublisher } from './application/ports/event-publisher.port';
import { CreateQuestionUseCase } from './application/use-cases/create-question/create-question.use-case';
import { CreateTopicUseCase } from './application/use-cases/create-topic/create-topic.use-case';
import { DeleteQuestionUseCase } from './application/use-cases/delete-question/delete-question.use-case';
import { GetQuestionPoolUseCase } from './application/use-cases/get-question-pool/get-question-pool.use-case';
import { GetQuestionUseCase } from './application/use-cases/get-question/get-question.use-case';
import { GetTopicUseCase } from './application/use-cases/get-topic/get-topic.use-case';
import { ListQuestionsUseCase } from './application/use-cases/list-questions/list-questions.use-case';
import { ListTopicsUseCase } from './application/use-cases/list-topics/list-topics.use-case';
import { ReportQuestionUseCase } from './application/use-cases/report-question/report-question.use-case';
import { UpdateQuestionUseCase } from './application/use-cases/update-question/update-question.use-case';
import { UpdateTopicUseCase } from './application/use-cases/update-topic/update-topic.use-case';
import { QuestionRepository } from './domain/repositories/question.repository';
import { QuestionTopicRepository } from './domain/repositories/question-topic.repository';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';
import {
  MEDIA_SERVICE_CLIENT,
  RABBITMQ_CLIENT,
  RabbitMqEventPublisher,
} from './infrastructure/messaging/rabbitmq-event-publisher.service';
import { PrismaQuestionRepository } from './infrastructure/persistence/prisma/prisma-question.repository';
import { PrismaQuestionTopicRepository } from './infrastructure/persistence/prisma/prisma-question-topic.repository';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { PublicQuestionController } from './presentation/http/public-question.controller';
import { QuestionController } from './presentation/http/question.controller';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          createRabbitMqClientOptions(config, 'question_service_publish'),
      },
      {
        name: MEDIA_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          createRabbitMqClientOptions(config, 'media_service_events'),
      },
    ]),
  ],
  controllers: [QuestionController, PublicQuestionController],
  providers: [
    PrismaService,
    DomainExceptionFilter,
    { provide: QuestionRepository, useClass: PrismaQuestionRepository },
    {
      provide: QuestionTopicRepository,
      useClass: PrismaQuestionTopicRepository,
    },
    { provide: EventPublisher, useClass: RabbitMqEventPublisher },
    CreateQuestionUseCase,
    UpdateQuestionUseCase,
    DeleteQuestionUseCase,
    GetQuestionUseCase,
    ListQuestionsUseCase,
    GetQuestionPoolUseCase,
    CreateTopicUseCase,
    UpdateTopicUseCase,
    GetTopicUseCase,
    ListTopicsUseCase,
    ReportQuestionUseCase,
  ],
})
export class QuestionModule {}
