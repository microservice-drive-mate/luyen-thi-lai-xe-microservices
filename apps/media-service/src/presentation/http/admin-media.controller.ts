import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { DeleteFileCommand } from '../../application/use-cases/delete-file/delete-file.command';
import { DeleteFileUseCase } from '../../application/use-cases/delete-file/delete-file.use-case';
import { ListFilesQuery } from '../../application/use-cases/list-files/list-files.query';
import { ListFilesUseCase } from '../../application/use-cases/list-files/list-files.use-case';
import { PaginatedFileObjectsResponseDto } from '../dtos/file-object.response.dto';
import { ListFilesQueryDto } from '../dtos/list-files.query.dto';

interface JwtPayload {
  sub?: string;
}

function resolveActorId(user: JwtPayload | undefined, headerUserId?: string) {
  return user?.sub ?? headerUserId ?? '';
}

@ApiTags('Admin Media')
@ApiBearerAuth()
@Controller('admin/media/files')
export class AdminMediaController {
  constructor(
    private readonly deleteFileUseCase: DeleteFileUseCase,
    private readonly listFilesUseCase: ListFilesUseCase,
  ) {}

  @Get()
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiOperation({ summary: 'List uploaded files for admin dashboard' })
  async listFiles(
    @Query() query: ListFilesQueryDto,
  ): Promise<PaginatedFileObjectsResponseDto> {
    const result = await this.listFilesUseCase.execute(
      new ListFilesQuery(
        query.page,
        query.size,
        query.uploadedById,
        query.mimeType,
      ),
    );
    return PaginatedFileObjectsResponseDto.fromResult(result);
  }

  @Delete(':id')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete file from storage and database' })
  async deleteFile(
    @Param('id') id: string,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
  ): Promise<void> {
    await this.deleteFileUseCase.execute(
      new DeleteFileCommand(id, resolveActorId(user, headerUserId)),
    );
  }
}
