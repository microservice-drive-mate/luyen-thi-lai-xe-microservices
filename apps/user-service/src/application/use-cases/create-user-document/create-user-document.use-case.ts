import { Injectable, NotFoundException } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { UserDocumentResult } from '../shared/user-document.result';
import { CreateUserDocumentCommand } from './create-user-document.command';

@Injectable()
export class CreateUserDocumentUseCase
  implements IUseCase<CreateUserDocumentCommand, UserDocumentResult>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: CreateUserDocumentCommand,
  ): Promise<UserDocumentResult> {
    const userExists = await this.prisma.userProfile.findUnique({
      where: { id: command.userId },
      select: { id: true },
    });
    if (!userExists) throw new NotFoundException('User profile not found');

    const document = await this.prisma.userDocument.create({
      data: {
        userId: command.userId,
        type: command.type,
        mediaFileId: command.mediaFileId,
        title: command.title,
        status: command.status,
      },
    });
    return UserDocumentResult.fromRecord(document);
  }
}
