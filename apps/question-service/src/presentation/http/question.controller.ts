import {
  Body,
  Controller,
  Delete,
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
import { CreateQuestionCommand } from '../../application/use-cases/create-question/create-question.command';
import { CreateQuestionUseCase } from '../../application/use-cases/create-question/create-question.use-case';
import { CreateTopicCommand } from '../../application/use-cases/create-topic/create-topic.command';
import { CreateTopicUseCase } from '../../application/use-cases/create-topic/create-topic.use-case';
import { DeleteQuestionCommand } from '../../application/use-cases/delete-question/delete-question.command';
import { DeleteQuestionUseCase } from '../../application/use-cases/delete-question/delete-question.use-case';
import { GetQuestionPoolQuery } from '../../application/use-cases/get-question-pool/get-question-pool.query';
import { GetQuestionPoolUseCase } from '../../application/use-cases/get-question-pool/get-question-pool.use-case';
import { GetQuestionQuery } from '../../application/use-cases/get-question/get-question.query';
import { GetQuestionUseCase } from '../../application/use-cases/get-question/get-question.use-case';
import { GetTopicQuery } from '../../application/use-cases/get-topic/get-topic.query';
import { GetTopicUseCase } from '../../application/use-cases/get-topic/get-topic.use-case';
import { ListQuestionsQuery } from '../../application/use-cases/list-questions/list-questions.query';
import { ListQuestionsUseCase } from '../../application/use-cases/list-questions/list-questions.use-case';
import { ListTopicsQuery } from '../../application/use-cases/list-topics/list-topics.query';
import { ListTopicsUseCase } from '../../application/use-cases/list-topics/list-topics.use-case';
import { UpdateQuestionCommand } from '../../application/use-cases/update-question/update-question.command';
import { UpdateQuestionUseCase } from '../../application/use-cases/update-question/update-question.use-case';
import { UpdateTopicCommand } from '../../application/use-cases/update-topic/update-topic.command';
import { UpdateTopicUseCase } from '../../application/use-cases/update-topic/update-topic.use-case';
import { CreateQuestionRequestDto } from '../dtos/create-question.request.dto';
import { CreateTopicRequestDto } from '../dtos/create-topic.request.dto';
import { DeleteQuestionRequestDto } from '../dtos/delete-question.request.dto';
import { ListQuestionsQueryDto } from '../dtos/list-questions.query.dto';
import { ListTopicsQueryDto } from '../dtos/list-topics.query.dto';
import { QuestionPoolRequestDto } from '../dtos/question-pool.request.dto';
import {
  ListQuestionsResponseDto,
  QuestionPoolResponseDto,
  QuestionResponseDto,
} from '../dtos/question.response.dto';
import {
  ListQuestionTopicsResponseDto,
  QuestionTopicResponseDto,
} from '../dtos/question-topic.response.dto';
import { UpdateQuestionRequestDto } from '../dtos/update-question.request.dto';
import { UpdateTopicRequestDto } from '../dtos/update-topic.request.dto';

interface JwtPayload {
  sub?: string;
}

function resolveActorId(user: JwtPayload | undefined, headerUserId?: string) {
  return user?.sub ?? headerUserId ?? '';
}

const QUESTION_ADMIN_ROLES = ['realm:ADMIN', 'realm:CENTER_MANAGER'];

@ApiTags('Questions')
@ApiBearerAuth()
@Controller('admin/questions')
export class QuestionController {
  constructor(
    private readonly createQuestionUseCase: CreateQuestionUseCase,
    private readonly updateQuestionUseCase: UpdateQuestionUseCase,
    private readonly deleteQuestionUseCase: DeleteQuestionUseCase,
    private readonly getQuestionUseCase: GetQuestionUseCase,
    private readonly listQuestionsUseCase: ListQuestionsUseCase,
    private readonly getQuestionPoolUseCase: GetQuestionPoolUseCase,
    private readonly createTopicUseCase: CreateTopicUseCase,
    private readonly updateTopicUseCase: UpdateTopicUseCase,
    private readonly getTopicUseCase: GetTopicUseCase,
    private readonly listTopicsUseCase: ListTopicsUseCase,
  ) {}

  @Post('topics')
  @Roles({ roles: QUESTION_ADMIN_ROLES })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create question topic' })
  async createTopic(
    @Body() dto: CreateTopicRequestDto,
  ): Promise<QuestionTopicResponseDto> {
    const result = await this.createTopicUseCase.execute(
      new CreateTopicCommand(dto.name, dto.description, dto.parentId),
    );
    return QuestionTopicResponseDto.fromResult(result);
  }

  @Get('topics')
  @Roles({ roles: QUESTION_ADMIN_ROLES })
  @ApiOperation({ summary: 'List question topics' })
  async listTopics(
    @Query() query: ListTopicsQueryDto,
  ): Promise<ListQuestionTopicsResponseDto> {
    const result = await this.listTopicsUseCase.execute(
      new ListTopicsQuery(query.page ?? 1, query.size ?? 20, query.parentId),
    );
    return ListQuestionTopicsResponseDto.fromResult(result);
  }

  @Get('topics/:id')
  @Roles({ roles: QUESTION_ADMIN_ROLES })
  @ApiOperation({ summary: 'Get question topic detail' })
  async getTopic(@Param('id') id: string): Promise<QuestionTopicResponseDto> {
    const result = await this.getTopicUseCase.execute(new GetTopicQuery(id));
    return QuestionTopicResponseDto.fromResult(result);
  }

  @Patch('topics/:id')
  @Roles({ roles: QUESTION_ADMIN_ROLES })
  @ApiOperation({ summary: 'Update question topic' })
  async updateTopic(
    @Param('id') id: string,
    @Body() dto: UpdateTopicRequestDto,
  ): Promise<QuestionTopicResponseDto> {
    const result = await this.updateTopicUseCase.execute(
      new UpdateTopicCommand(id, dto.name, dto.description, dto.parentId),
    );
    return QuestionTopicResponseDto.fromResult(result);
  }

  @Post('pool')
  @Roles({
    roles: ['realm:ADMIN', 'realm:CENTER_MANAGER', 'realm:INSTRUCTOR'],
  })
  @ApiOperation({ summary: 'Get active question pool for exam-service' })
  async getPool(
    @Body() dto: QuestionPoolRequestDto,
  ): Promise<QuestionPoolResponseDto> {
    const result = await this.getQuestionPoolUseCase.execute(
      new GetQuestionPoolQuery(
        dto.licenseCategory,
        dto.size,
        dto.type,
        dto.difficulty,
        dto.topicId,
        dto.isCritical,
        dto.excludeQuestionIds,
      ),
    );
    return QuestionPoolResponseDto.fromResult(result);
  }

  @Post()
  @Roles({ roles: QUESTION_ADMIN_ROLES })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create question' })
  async createQuestion(
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Body() dto: CreateQuestionRequestDto,
  ): Promise<QuestionResponseDto> {
    const result = await this.createQuestionUseCase.execute(
      new CreateQuestionCommand(
        dto.content,
        dto.type,
        dto.licenseCategories,
        dto.difficulty,
        dto.explanation,
        dto.topicId,
        resolveActorId(user, headerUserId),
        dto.options,
        dto.imageUrl,
        dto.mediaFileId,
        dto.isCritical,
        dto.isActive,
      ),
    );
    return QuestionResponseDto.fromResult(result);
  }

  @Get()
  @Roles({ roles: QUESTION_ADMIN_ROLES })
  @ApiOperation({ summary: 'Search question bank' })
  async listQuestions(
    @Query() query: ListQuestionsQueryDto,
  ): Promise<ListQuestionsResponseDto> {
    const result = await this.listQuestionsUseCase.execute(
      new ListQuestionsQuery(
        query.page ?? 1,
        query.size ?? 20,
        query.keyword,
        query.licenseCategory,
        query.type,
        query.difficulty,
        query.topicId,
        query.isCritical,
        query.isActive,
        query.includeDeleted,
      ),
    );
    return ListQuestionsResponseDto.fromResult(result);
  }

  @Get(':id')
  @Roles({ roles: QUESTION_ADMIN_ROLES })
  @ApiOperation({ summary: 'Get question detail' })
  async getQuestion(@Param('id') id: string): Promise<QuestionResponseDto> {
    const result = await this.getQuestionUseCase.execute(
      new GetQuestionQuery(id),
    );
    return QuestionResponseDto.fromResult(result);
  }

  @Patch(':id')
  @Roles({ roles: QUESTION_ADMIN_ROLES })
  @ApiOperation({ summary: 'Update question' })
  async updateQuestion(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionRequestDto,
  ): Promise<QuestionResponseDto> {
    const result = await this.updateQuestionUseCase.execute(
      new UpdateQuestionCommand(
        id,
        dto.version,
        dto.content,
        dto.type,
        dto.licenseCategories,
        dto.difficulty,
        dto.explanation,
        dto.imageUrl,
        dto.mediaFileId,
        dto.isCritical,
        dto.isActive,
        dto.topicId,
        dto.options,
      ),
    );
    return QuestionResponseDto.fromResult(result);
  }

  @Delete(':id')
  @Roles({ roles: QUESTION_ADMIN_ROLES })
  @ApiOperation({ summary: 'Soft delete question' })
  async deleteQuestion(
    @Param('id') id: string,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Body() dto: DeleteQuestionRequestDto,
  ): Promise<QuestionResponseDto> {
    const result = await this.deleteQuestionUseCase.execute(
      new DeleteQuestionCommand(
        id,
        resolveActorId(user, headerUserId),
        dto.version,
      ),
    );
    return QuestionResponseDto.fromResult(result);
  }
}
