import { Controller, Get, Headers, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { ListAvailableExamsQuery } from '../../application/use-cases/list-available-exams/list-available-exams.query';
import { ListAvailableExamsUseCase } from '../../application/use-cases/list-available-exams/list-available-exams.use-case';
import { ListAvailableExamsResponseDto } from '../dtos/available-exam.response.dto';
import { ListAvailableExamsQueryDto } from '../dtos/list-available-exams.query.dto';

interface JwtPayload {
  sub?: string;
}

function getBearerToken(authorization?: string): string {
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
}

@ApiTags('Exams')
@ApiBearerAuth()
@Controller('exams')
export class ExamController {
  constructor(
    private readonly listAvailableExamsUseCase: ListAvailableExamsUseCase,
  ) {}

  @Get('available')
  @Roles({ roles: ['realm:STUDENT'] })
  @ApiOperation({ summary: 'List exam templates available to current student' })
  @ApiOkResponse({ type: ListAvailableExamsResponseDto })
  async listAvailableExams(
    @AuthenticatedUser() user: JwtPayload,
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ListAvailableExamsQueryDto,
  ): Promise<ListAvailableExamsResponseDto> {
    const result = await this.listAvailableExamsUseCase.execute(
      new ListAvailableExamsQuery(
        user.sub ?? '',
        getBearerToken(authorization),
        query.page ?? 1,
        query.size ?? 20,
      ),
    );
    return ListAvailableExamsResponseDto.fromResult(result);
  }
}
