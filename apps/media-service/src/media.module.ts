import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EventPublisher } from './application/ports/event-publisher.port';
import { StoragePort } from './application/ports/storage.port';
import { ConfirmFileLinkedUseCase } from './application/use-cases/confirm-file-linked/confirm-file-linked.use-case';
import { DeleteFileUseCase } from './application/use-cases/delete-file/delete-file.use-case';
import { GetFileMetadataUseCase } from './application/use-cases/get-file-metadata/get-file-metadata.use-case';
import { GetPresignedUrlUseCase } from './application/use-cases/get-presigned-url/get-presigned-url.use-case';
import { InitiateUploadUseCase } from './application/use-cases/initiate-upload/initiate-upload.use-case';
import { ListFilesUseCase } from './application/use-cases/list-files/list-files.use-case';
import { UploadFileUseCase } from './application/use-cases/upload-file/upload-file.use-case';
import { FileObjectRepository } from './domain/repositories/file-object.repository';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';
import {
  COURSE_SERVICE_CLIENT,
  RABBITMQ_CLIENT,
  RabbitMqEventPublisher,
  USER_SERVICE_CLIENT,
} from './infrastructure/messaging/rabbitmq-event-publisher.service';
import { PrismaFileObjectRepository } from './infrastructure/persistence/prisma/prisma-file-object.repository';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { AzureBlobStorageProvider } from './infrastructure/storage/azure-blob-storage.provider';
import { AdminMediaController } from './presentation/http/admin-media.controller';
import { MediaController } from './presentation/http/media.controller';
import { MessagingController } from './presentation/messaging/messaging.controller';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>('rabbitmq.url') ?? 'amqp://127.0.0.1:5672',
            ],
            queue: 'media_service_publish',
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: USER_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>('rabbitmq.url') ?? 'amqp://127.0.0.1:5672',
            ],
            queue: 'user_service_events',
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: COURSE_SERVICE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>('rabbitmq.url') ?? 'amqp://127.0.0.1:5672',
            ],
            queue: 'course_service_events',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [MediaController, AdminMediaController, MessagingController],
  providers: [
    PrismaService,
    DomainExceptionFilter,

    { provide: FileObjectRepository, useClass: PrismaFileObjectRepository },
    { provide: StoragePort, useClass: AzureBlobStorageProvider },
    { provide: EventPublisher, useClass: RabbitMqEventPublisher },

    UploadFileUseCase,
    InitiateUploadUseCase,
    ConfirmFileLinkedUseCase,
    GetFileMetadataUseCase,
    GetPresignedUrlUseCase,
    DeleteFileUseCase,
    ListFilesUseCase,
  ],
})
export class MediaModule {}
