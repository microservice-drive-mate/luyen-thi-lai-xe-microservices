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
import { CreateTemplateCommand } from '../../application/use-cases/create-template/create-template.command';
import { CreateTemplateUseCase } from '../../application/use-cases/create-template/create-template.use-case';
import { DeleteTemplateCommand } from '../../application/use-cases/delete-template/delete-template.command';
import { DeleteTemplateUseCase } from '../../application/use-cases/delete-template/delete-template.use-case';
import { GetTemplateQuery } from '../../application/use-cases/get-template/get-template.query';
import { GetTemplateUseCase } from '../../application/use-cases/get-template/get-template.use-case';
import { ListTemplatesQuery } from '../../application/use-cases/list-templates/list-templates.query';
import { ListTemplatesUseCase } from '../../application/use-cases/list-templates/list-templates.use-case';
import { UpdateTemplateCommand } from '../../application/use-cases/update-template/update-template.command';
import { UpdateTemplateUseCase } from '../../application/use-cases/update-template/update-template.use-case';
import { CreateTemplateRequestDto } from '../dtos/create-template.request.dto';
import { DeleteTemplateRequestDto } from '../dtos/delete-template.request.dto';
import {
  ExamTemplateResponseDto,
  ListExamTemplatesResponseDto,
} from '../dtos/exam-template.response.dto';
import { ListTemplatesQueryDto } from '../dtos/list-templates.query.dto';
import { UpdateTemplateRequestDto } from '../dtos/update-template.request.dto';

interface JwtPayload {
  sub?: string;
}

function resolveActorId(user: JwtPayload | undefined, headerUserId?: string) {
  return user?.sub ?? headerUserId ?? '';
}

@ApiTags('Exam Templates')
@ApiBearerAuth()
@Controller('admin/exams/templates')
export class ExamTemplateController {
  constructor(
    private readonly createTemplateUseCase: CreateTemplateUseCase,
    private readonly updateTemplateUseCase: UpdateTemplateUseCase,
    private readonly deleteTemplateUseCase: DeleteTemplateUseCase,
    private readonly getTemplateUseCase: GetTemplateUseCase,
    private readonly listTemplatesUseCase: ListTemplatesUseCase,
  ) {}

  @Post()
  @Roles({ roles: ['realm:ADMIN'] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create exam template' })
  async createTemplate(
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Body() dto: CreateTemplateRequestDto,
  ): Promise<ExamTemplateResponseDto> {
    const result = await this.createTemplateUseCase.execute(
      new CreateTemplateCommand(
        dto.name,
        dto.licenseCategory,
        dto.totalQuestions,
        dto.passingScore,
        dto.durationMinutes,
        resolveActorId(user, headerUserId),
      ),
    );
    return ExamTemplateResponseDto.fromResult(result);
  }

  @Get()
  @Roles({ roles: ['realm:ADMIN'] })
  @ApiOperation({ summary: 'List exam templates' })
  async listTemplates(
    @Query() query: ListTemplatesQueryDto,
  ): Promise<ListExamTemplatesResponseDto> {
    const result = await this.listTemplatesUseCase.execute(
      new ListTemplatesQuery(
        query.page ?? 1,
        query.size ?? 20,
        query.licenseCategory,
        query.isActive,
        query.includeDeleted,
      ),
    );
    return ListExamTemplatesResponseDto.fromResult(result);
  }

  @Get(':id')
  @Roles({ roles: ['realm:ADMIN'] })
  @ApiOperation({ summary: 'Get exam template detail' })
  async getTemplate(@Param('id') id: string): Promise<ExamTemplateResponseDto> {
    const result = await this.getTemplateUseCase.execute(
      new GetTemplateQuery(id),
    );
    return ExamTemplateResponseDto.fromResult(result);
  }

  @Patch(':id')
  @Roles({ roles: ['realm:ADMIN'] })
  @ApiOperation({ summary: 'Update exam template' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateRequestDto,
  ): Promise<ExamTemplateResponseDto> {
    const result = await this.updateTemplateUseCase.execute(
      new UpdateTemplateCommand(
        id,
        dto.version,
        dto.name,
        dto.totalQuestions,
        dto.passingScore,
        dto.durationMinutes,
        dto.isActive,
      ),
    );
    return ExamTemplateResponseDto.fromResult(result);
  }

  @Delete(':id')
  @Roles({ roles: ['realm:ADMIN'] })
  @ApiOperation({ summary: 'Soft delete exam template' })
  async deleteTemplate(
    @Param('id') id: string,
    @Body() dto: DeleteTemplateRequestDto,
  ): Promise<ExamTemplateResponseDto> {
    const result = await this.deleteTemplateUseCase.execute(
      new DeleteTemplateCommand(id, dto.version),
    );
    return ExamTemplateResponseDto.fromResult(result);
  }
}
