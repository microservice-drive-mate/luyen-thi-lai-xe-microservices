import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { ListMissedQuestionsQuery } from '../../application/use-cases/list-missed-questions/list-missed-questions.query';
import { ListMissedQuestionsUseCase } from '../../application/use-cases/list-missed-questions/list-missed-questions.use-case';
import { ListMissedQuestionsQueryDto } from '../dtos/list-missed-questions.query.dto';
import { ListMissedQuestionsResponseDto } from '../dtos/missed-question.response.dto';

interface JwtPayload {
  sub?: string;
}

@ApiTags('Exam Review')
@ApiBearerAuth()
@Controller('exams/review')
export class ExamReviewController {
  constructor(
    private readonly listMissedQuestionsUseCase: ListMissedQuestionsUseCase,
  ) {}

  @Get('missed-questions')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'List frequently missed questions for review' })
  async listMissedQuestions(
    @AuthenticatedUser() user: JwtPayload,
    @Query() query: ListMissedQuestionsQueryDto,
  ): Promise<ListMissedQuestionsResponseDto> {
    const result = await this.listMissedQuestionsUseCase.execute(
      new ListMissedQuestionsQuery(
        user.sub ?? '',
        query.limit ?? query.size ?? 20,
        query.periodDays ?? query.period,
        query.mode ?? 'frequent',
      ),
    );
    return ListMissedQuestionsResponseDto.fromItems(result);
  }
}
