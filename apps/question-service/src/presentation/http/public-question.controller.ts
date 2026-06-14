import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { ListQuestionsQuery } from '../../application/use-cases/list-questions/list-questions.query';
import { ListQuestionsUseCase } from '../../application/use-cases/list-questions/list-questions.use-case';
import { ListTopicsQuery } from '../../application/use-cases/list-topics/list-topics.query';
import { ListTopicsUseCase } from '../../application/use-cases/list-topics/list-topics.use-case';
import { ReportQuestionCommand } from '../../application/use-cases/report-question/report-question.command';
import { ReportQuestionUseCase } from '../../application/use-cases/report-question/report-question.use-case';
import { ListQuestionsQueryDto } from '../dtos/list-questions.query.dto';
import { ListTopicsQueryDto } from '../dtos/list-topics.query.dto';
import { PublicPracticeQuestionsResponseDto } from '../dtos/public-question.response.dto';
import {
  CreateQuestionReportRequestDto,
  QuestionReportResponseDto,
} from '../dtos/question-report.request.dto';
import { ListQuestionTopicsResponseDto } from '../dtos/question-topic.response.dto';

interface JwtPayload {
  sub?: string;
}

@ApiTags('Questions')
@ApiBearerAuth()
@Controller('questions')
export class PublicQuestionController {
  constructor(
    private readonly listQuestionsUseCase: ListQuestionsUseCase,
    private readonly listTopicsUseCase: ListTopicsUseCase,
    private readonly reportQuestionUseCase: ReportQuestionUseCase,
  ) {}

  @Get('topics')
  @Roles({
    roles: [
      'realm:STUDENT',
      'realm:INSTRUCTOR',
      'realm:ADMIN',
      'realm:CENTER_MANAGER',
    ],
  })
  @ApiOperation({ summary: 'List question topics for practice' })
  async listTopics(
    @Query() query: ListTopicsQueryDto,
  ): Promise<ListQuestionTopicsResponseDto> {
    const result = await this.listTopicsUseCase.execute(
      new ListTopicsQuery(query.page ?? 1, query.size ?? 100, query.parentId),
    );
    return ListQuestionTopicsResponseDto.fromResult(result);
  }

  @Get('practice')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'List student-safe practice questions' })
  async listPracticeQuestions(
    @Query() query: ListQuestionsQueryDto,
  ): Promise<PublicPracticeQuestionsResponseDto> {
    const result = await this.listQuestionsUseCase.execute(
      new ListQuestionsQuery(
        query.page ?? 1,
        query.size ?? 20,
        query.keyword,
        query.licenseCategory,
        query.type,
        query.difficulty,
        query.topicId,
        undefined,
        true,
        false,
      ),
    );
    return PublicPracticeQuestionsResponseDto.fromResult(result);
  }

  @Post(':id/report')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'Report an issue with a practice question' })
  async report(
    @AuthenticatedUser() user: JwtPayload,
    @Param('id') questionId: string,
    @Body() dto: CreateQuestionReportRequestDto,
  ): Promise<QuestionReportResponseDto> {
    return this.reportQuestionUseCase.execute(
      new ReportQuestionCommand(
        questionId,
        user.sub ?? '',
        dto.reason,
        dto.message,
      ),
    );
  }
}
