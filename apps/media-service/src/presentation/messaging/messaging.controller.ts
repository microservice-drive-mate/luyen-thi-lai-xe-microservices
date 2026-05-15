import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { Public } from 'nest-keycloak-connect';
import { ConfirmFileLinkedCommand } from '../../application/use-cases/confirm-file-linked/confirm-file-linked.command';
import { ConfirmFileLinkedUseCase } from '../../application/use-cases/confirm-file-linked/confirm-file-linked.use-case';

interface FileLinkedPayload {
  mediaFileId: string;
}

@Controller()
@Public()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(
    private readonly confirmFileLinkedUseCase: ConfirmFileLinkedUseCase,
  ) {}

  @EventPattern('user.avatar.linked')
  async handleUserAvatarLinked(
    @Payload() payload: FileLinkedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received user.avatar.linked for mediaFileId=${payload.mediaFileId}`,
    );
    await this.confirmFileLinkedUseCase.execute(
      new ConfirmFileLinkedCommand(payload.mediaFileId),
    );
  }

  @EventPattern('course.material.linked')
  async handleCourseMaterialLinked(
    @Payload() payload: FileLinkedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received course.material.linked for mediaFileId=${payload.mediaFileId}`,
    );
    await this.confirmFileLinkedUseCase.execute(
      new ConfirmFileLinkedCommand(payload.mediaFileId),
    );
  }

  @EventPattern('question.image.linked')
  async handleQuestionImageLinked(
    @Payload() payload: FileLinkedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received question.image.linked for mediaFileId=${payload.mediaFileId}`,
    );
    await this.confirmFileLinkedUseCase.execute(
      new ConfirmFileLinkedCommand(payload.mediaFileId),
    );
  }
}
