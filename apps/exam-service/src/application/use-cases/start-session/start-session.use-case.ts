import { Injectable } from '@nestjs/common';
import { IUseCase, MetricsService } from '@repo/common';
import { ExamSession } from '../../../domain/aggregates/exam-session/exam-session.aggregate';
import {
  ExamTopicDistributionItem,
  LicenseCategory,
} from '../../../domain/aggregates/exam-template/exam-template.types';
import {
  ExamTemplateInactiveException,
  ExamTemplateNotFoundException,
  InsufficientQuestionPoolException,
  StudentLicenseMismatchException,
  StudentProfileInvalidException,
} from '../../../domain/exceptions/exam.exceptions';
import { ExamSessionRepository } from '../../../domain/repositories/exam-session.repository';
import { ExamTemplateRepository } from '../../../domain/repositories/exam-template.repository';
import {
  QuestionPoolClient,
  QuestionPoolItem,
} from '../../ports/question-pool.client';
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
    private readonly metricsService: MetricsService,
  ) {}

  async execute(command: StartSessionCommand): Promise<ExamSessionResult> {
    const template = await this.templateRepository.findById(command.templateId);
    if (!template) {
      throw new ExamTemplateNotFoundException(
        'Exam resource not found. (MSG38)',
      );
    }
    if (!template.isActive || template.isDeleted) {
      throw new ExamTemplateInactiveException(
        'Exam resource not found. (MSG38)',
      );
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
        'Exam resource not found. (MSG38)',
      );
    }
    if (profile.studentDetail.licenseTier !== template.licenseCategory) {
      throw new StudentLicenseMismatchException(
        'Invalid exam start request. (MSG36)',
      );
    }

    const questions = await this.selectQuestions(
      template.licenseCategory,
      template.topicDistribution,
      template.criticalQuestions,
      template.shuffleQuestions,
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
      templateNameSnapshot: template.name,
      templateVersionSnapshot: template.version,
      licenseCategory: template.licenseCategory,
      totalQuestionsSnapshot: template.totalQuestions,
      passingScore: template.passingScore,
      durationMinutes: template.durationMinutes,
      criticalQuestionsSnapshot: template.criticalQuestions,
      topicDistributionSnapshot: template.topicDistribution,
      maxCriticalMistakes: template.maxCriticalMistakes,
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
          const options = template.shuffleQuestions
            ? this.shuffle(question.options)
            : question.options;
          return {
            questionId: question.id,
            questionContent: question.content,
            imageUrl: question.imageUrl,
            mediaFileId: question.mediaFileId,
            optionsSnapshot: options.map((option, optionIndex) => ({
              id: option.id,
              content: option.content,
              displayOrder: optionIndex + 1,
            })),
            correctOptionId: correctOption.id,
            isCritical: question.isCritical,
            displayOrder: index + 1,
          };
        }),
    });

    await this.sessionRepository.save(session);
    this.metricsService.recordExamSessionStarted({
      licenseCategory: session.licenseCategory,
    });
    return ExamSessionResult.fromAggregate(session);
  }

  private async selectQuestions(
    licenseCategory: LicenseCategory,
    topicDistribution: ExamTopicDistributionItem[],
    criticalQuestions: number,
    shuffleQuestions: boolean,
  ): Promise<QuestionPoolItem[]> {
    const selectedByTopic = new Map<string, QuestionPoolItem[]>();
    for (const distribution of topicDistribution) {
      const items = await this.questionPoolClient.getPool({
        licenseCategory,
        size: distribution.questionCount,
        topicId: distribution.topicId,
      });
      if (items.length < distribution.questionCount) {
        throw new InsufficientQuestionPoolException(
          distribution.questionCount,
          items.length,
        );
      }
      selectedByTopic.set(
        distribution.topicId,
        items.slice(0, distribution.questionCount),
      );
    }

    const countCritical = () =>
      [...selectedByTopic.values()]
        .flat()
        .filter((question) => question.isCritical).length;

    let currentCriticalQuestions = countCritical();
    if (currentCriticalQuestions > criticalQuestions) {
      for (const distribution of topicDistribution) {
        if (currentCriticalQuestions <= criticalQuestions) break;
        const selected = selectedByTopic.get(distribution.topicId) ?? [];
        const replaceable = selected.filter((question) => question.isCritical);
        if (replaceable.length < 1) continue;

        const excess = currentCriticalQuestions - criticalQuestions;
        const existingIds = [...selectedByTopic.values()]
          .flat()
          .map((question) => question.id);
        const nonCriticalPool = await this.questionPoolClient.getPool({
          licenseCategory,
          size: Math.min(excess, replaceable.length),
          topicId: distribution.topicId,
          isCritical: false,
          excludeQuestionIds: existingIds,
        });

        const replacements = nonCriticalPool.slice(0, replaceable.length);
        for (const replacement of replacements) {
          if (currentCriticalQuestions <= criticalQuestions) break;
          const index = selected.findIndex((question) => question.isCritical);
          if (index === -1) break;
          selected[index] = replacement;
          currentCriticalQuestions -= 1;
        }
        selectedByTopic.set(distribution.topicId, selected);
      }
    }

    if (currentCriticalQuestions < criticalQuestions) {
      for (const distribution of topicDistribution) {
        if (currentCriticalQuestions >= criticalQuestions) break;
        const selected = selectedByTopic.get(distribution.topicId) ?? [];
        const replaceable = selected.filter((question) => !question.isCritical);
        if (replaceable.length < 1) continue;

        const missing = criticalQuestions - currentCriticalQuestions;
        const existingIds = [...selectedByTopic.values()]
          .flat()
          .map((question) => question.id);
        const criticalPool = await this.questionPoolClient.getPool({
          licenseCategory,
          size: Math.min(missing, replaceable.length),
          topicId: distribution.topicId,
          isCritical: true,
          excludeQuestionIds: existingIds,
        });

        const replacements = criticalPool.slice(0, replaceable.length);
        for (const replacement of replacements) {
          if (currentCriticalQuestions >= criticalQuestions) break;
          const index = selected.findIndex((question) => !question.isCritical);
          if (index === -1) break;
          selected[index] = replacement;
          currentCriticalQuestions += 1;
        }
        selectedByTopic.set(distribution.topicId, selected);
      }
    }

    const selectedQuestions = topicDistribution.flatMap(
      (distribution) => selectedByTopic.get(distribution.topicId) ?? [],
    );
    const actualCriticalQuestions = selectedQuestions.filter(
      (question) => question.isCritical,
    ).length;
    if (actualCriticalQuestions !== criticalQuestions) {
      throw new InsufficientQuestionPoolException(
        criticalQuestions,
        actualCriticalQuestions,
      );
    }

    return shuffleQuestions
      ? this.shuffle(selectedQuestions)
      : selectedQuestions;
  }

  private shuffle<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index],
      ];
    }
    return shuffled;
  }
}
