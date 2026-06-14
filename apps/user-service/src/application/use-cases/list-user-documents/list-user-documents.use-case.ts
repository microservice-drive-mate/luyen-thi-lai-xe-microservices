import { Injectable, NotFoundException } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { UserDocumentResult } from '../shared/user-document.result';
import { ListUserDocumentsQuery } from './list-user-documents.query';

@Injectable()
export class ListUserDocumentsUseCase
  implements IUseCase<ListUserDocumentsQuery, UserDocumentResult[]>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListUserDocumentsQuery): Promise<UserDocumentResult[]> {
    const userExists = await this.prisma.userProfile.findUnique({
      where: { id: query.userId },
      select: { id: true },
    });
    if (!userExists) throw new NotFoundException('User profile not found');

    const documents = await this.prisma.userDocument.findMany({
      where: { userId: query.userId },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map(UserDocumentResult.fromRecord);
  }
}
