import { Injectable, NotFoundException } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { ReportQuestionCommand } from './report-question.command';

export interface QuestionReportResult {
  id: string;
  questionId: string;
  userId: string;
  reason: string;
  message: string | null;
  status: string;
  createdAt: Date;
}

@Injectable()
export class ReportQuestionUseCase
  implements IUseCase<ReportQuestionCommand, QuestionReportResult>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ReportQuestionCommand): Promise<QuestionReportResult> {
    const exists = await this.prisma.question.count({
      where: {
        id: command.questionId,
        isActive: true,
        isDeleted: false,
      },
    });
    if (!exists) throw new NotFoundException('Question not found');

    return this.prisma.questionReport.create({
      data: {
        questionId: command.questionId,
        userId: command.userId,
        reason: command.reason,
        message: command.message ?? null,
      },
    });
  }
}
