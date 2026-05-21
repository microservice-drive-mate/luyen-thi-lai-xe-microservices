import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { GetSessionQuestionsQuery } from '../../application/use-cases/get-session-questions/get-session-questions.query';
import { GetSessionQuestionsUseCase } from '../../application/use-cases/get-session-questions/get-session-questions.use-case';
import { GetSessionResultQuery } from '../../application/use-cases/get-session-result/get-session-result.query';
import { GetSessionResultUseCase } from '../../application/use-cases/get-session-result/get-session-result.use-case';
import { ListSessionsQuery } from '../../application/use-cases/list-sessions/list-sessions.query';
import { ListSessionsUseCase } from '../../application/use-cases/list-sessions/list-sessions.use-case';
import { SaveAnswerCommand } from '../../application/use-cases/save-answer/save-answer.command';
import { SaveAnswerUseCase } from '../../application/use-cases/save-answer/save-answer.use-case';
import { StartSessionCommand } from '../../application/use-cases/start-session/start-session.command';
import { StartSessionUseCase } from '../../application/use-cases/start-session/start-session.use-case';
import { SubmitSessionCommand } from '../../application/use-cases/submit-session/submit-session.command';
import { SubmitSessionUseCase } from '../../application/use-cases/submit-session/submit-session.use-case';
import {
  ExamSessionQuestionsResponseDto,
  ExamSessionResponseDto,
  ExamSessionResultResponseDto,
  ListExamSessionsResponseDto,
} from '../dtos/exam-session.response.dto';
import { ListSessionsQueryDto } from '../dtos/list-sessions.query.dto';
import { SaveAnswerRequestDto } from '../dtos/save-answer.request.dto';
import { StartSessionRequestDto } from '../dtos/start-session.request.dto';

interface JwtPayload {
  sub?: string;
}

function getBearerToken(authorization?: string): string {
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
}

@ApiTags('Exam Sessions')
@ApiBearerAuth()
@Controller('exams/sessions')
export class ExamSessionController {
  constructor(
    private readonly startSessionUseCase: StartSessionUseCase,
    private readonly saveAnswerUseCase: SaveAnswerUseCase,
    private readonly submitSessionUseCase: SubmitSessionUseCase,
    private readonly getSessionQuestionsUseCase: GetSessionQuestionsUseCase,
    private readonly getSessionResultUseCase: GetSessionResultUseCase,
    private readonly listSessionsUseCase: ListSessionsUseCase,
  ) {}

  @Post()
  @Roles({ roles: ['realm:STUDENT'] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start exam session' })
  async startSession(
    @AuthenticatedUser() user: JwtPayload,
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: StartSessionRequestDto,
  ): Promise<ExamSessionResponseDto> {
    const result = await this.startSessionUseCase.execute(
      new StartSessionCommand(
        dto.templateId,
        user.sub ?? '',
        getBearerToken(authorization),
      ),
    );
    return ExamSessionResponseDto.fromResult(result);
  }

  @Get()
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'List current student exam sessions' })
  async listSessions(
    @AuthenticatedUser() user: JwtPayload,
    @Query() query: ListSessionsQueryDto,
  ): Promise<ListExamSessionsResponseDto> {
    const result = await this.listSessionsUseCase.execute(
      new ListSessionsQuery(
        user.sub ?? '',
        query.page ?? 1,
        query.size ?? 20,
        query.status,
      ),
    );
    return ListExamSessionsResponseDto.fromResult(result);
  }

  @Get(':id/questions')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'Get exam session questions without answer keys' })
  async getQuestions(
    @AuthenticatedUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<ExamSessionQuestionsResponseDto> {
    const result = await this.getSessionQuestionsUseCase.execute(
      new GetSessionQuestionsQuery(id, user.sub ?? ''),
    );
    return ExamSessionQuestionsResponseDto.fromResult(result);
  }

  @Patch(':id/answers')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'Autosave answer or bookmark' })
  async saveAnswer(
    @AuthenticatedUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SaveAnswerRequestDto,
  ): Promise<ExamSessionResponseDto> {
    const result = await this.saveAnswerUseCase.execute(
      new SaveAnswerCommand(
        id,
        user.sub ?? '',
        dto.questionId,
        dto.selectedOptionId,
        dto.isBookmarked,
      ),
    );
    return ExamSessionResponseDto.fromResult(result);
  }

  @Post(':id/submit')
  @Roles({ roles: ['realm:STUDENT'] })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit and grade exam session' })
  async submitSession(
    @AuthenticatedUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<ExamSessionResultResponseDto> {
    const result = await this.submitSessionUseCase.execute(
      new SubmitSessionCommand(id, user.sub ?? ''),
    );
    return ExamSessionResultResponseDto.fromResult(result);
  }

  @Get(':id/result')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'Get graded exam result' })
  async getResult(
    @AuthenticatedUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<ExamSessionResultResponseDto> {
    const result = await this.getSessionResultUseCase.execute(
      new GetSessionResultQuery(id, user.sub ?? ''),
    );
    return ExamSessionResultResponseDto.fromResult(result);
  }
}
