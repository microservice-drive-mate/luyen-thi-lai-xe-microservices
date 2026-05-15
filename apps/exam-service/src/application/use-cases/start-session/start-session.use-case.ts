import { Injectable } from '@nestjs/common';
import { IUseCase } from '@repo/common';
import { ExamSession } from '../../../domain/aggregates/exam-session/exam-session.aggregate';
import {
  ExamTemplateInactiveException,
  ExamTemplateNotFoundException,
  InsufficientQuestionPoolException,
  StudentLicenseMismatchException,
  StudentProfileInvalidException,
} from '../../../domain/exceptions/exam.exceptions';
import { ExamSessionRepository } from '../../../domain/repositories/exam-session.repository';
import { ExamTemplateRepository } from '../../../domain/repositories/exam-template.repository';
import { QuestionPoolClient } from '../../ports/question-pool.client';
import { UserProfileClient } from '../../ports/user-profile.client';
import { ExamSessionResult } from '../shared/exam-session.result';
import { StartSessionCommand } from './start-session.command';

@Injectable()
export class StartSessionUseCase
  implements IUseCase<StartSessionCommand, ExamSessionResult>
{
  constructor(
    private readonly templateRepository: ExamTemplateRepository,
    private readonly sessionRepository: ExamSessionRepository,
    private readonly questionPoolClient: QuestionPoolClient,
    private readonly userProfileClient: UserProfileClient,
  ) {}

  async execute(command: StartSessionCommand): Promise<ExamSessionResult> {
    const template = await this.templateRepository.findById(command.templateId);
    if (!template) throw new ExamTemplateNotFoundException(command.templateId);
    if (!template.isActive || template.isDeleted) {
      throw new ExamTemplateInactiveException(command.templateId);
    }

    const profile = await this.userProfileClient.getCurrentStudentProfile(
      command.accessToken,
    );
    if (
      profile.id !== command.studentId ||
      profile.role !== 'STUDENT' ||
      !profile.isActive ||
      !profile.studentDetail
    ) {
      throw new StudentProfileInvalidException(
        'Current user is not an active student',
      );
    }
    if (profile.studentDetail.licenseTier !== template.licenseCategory) {
      throw new StudentLicenseMismatchException(
        'Student license tier does not match exam template',
      );
    }

    const questions = await this.questionPoolClient.getPool(
      template.licenseCategory,
      template.totalQuestions,
    );
    if (questions.length < template.totalQuestions) {
      throw new InsufficientQuestionPoolException(
        template.totalQuestions,
        questions.length,
      );
    }

    const session = ExamSession.create({
      studentId: command.studentId,
      templateId: template.id,
      licenseCategory: template.licenseCategory,
      passingScore: template.passingScore,
      durationMinutes: template.durationMinutes,
      questions: questions
        .slice(0, template.totalQuestions)
        .map((question, index) => {
          const correctOption = question.options.find(
            (option) => option.isCorrect,
          );
          if (!correctOption) {
            throw new InsufficientQuestionPoolException(
              template.totalQuestions,
              index,
            );
          }
          return {
            questionId: question.id,
            questionContent: question.content,
            optionsSnapshot: question.options.map((option) => ({
              id: option.id,
              content: option.content,
              displayOrder: option.displayOrder,
            })),
            correctOptionId: correctOption.id,
            isCritical: question.isCritical,
            displayOrder: index + 1,
          };
        }),
    });

    await this.sessionRepository.save(session);
    return ExamSessionResult.fromAggregate(session);
  }
}
