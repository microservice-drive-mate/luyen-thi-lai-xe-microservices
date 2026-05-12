import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UploadFileCommand } from '../../application/use-cases/upload-file/upload-file.command';
import { UploadFileUseCase } from '../../application/use-cases/upload-file/upload-file.use-case';
import { InitiateUploadCommand } from '../../application/use-cases/initiate-upload/initiate-upload.command';
import { InitiateUploadUseCase } from '../../application/use-cases/initiate-upload/initiate-upload.use-case';
import { GetFileMetadataQuery } from '../../application/use-cases/get-file-metadata/get-file-metadata.query';
import { GetFileMetadataUseCase } from '../../application/use-cases/get-file-metadata/get-file-metadata.use-case';
import { GetPresignedUrlQuery } from '../../application/use-cases/get-presigned-url/get-presigned-url.query';
import { GetPresignedUrlUseCase } from '../../application/use-cases/get-presigned-url/get-presigned-url.use-case';
import { DeleteFileCommand } from '../../application/use-cases/delete-file/delete-file.command';
import { DeleteFileUseCase } from '../../application/use-cases/delete-file/delete-file.use-case';
import { ListFilesQuery } from '../../application/use-cases/list-files/list-files.query';
import { ListFilesUseCase } from '../../application/use-cases/list-files/list-files.use-case';
import {
  FileObjectResponseDto,
  PaginatedFileObjectsResponseDto,
} from '../dtos/file-object.response.dto';
import { PresignedUrlResponseDto } from '../dtos/presigned-url.response.dto';
import { ListFilesQueryDto } from '../dtos/list-files.query.dto';
import { InitiateUploadRequestDto } from '../dtos/initiate-upload.request.dto';
import { InitiateUploadResponseDto } from '../dtos/initiate-upload.response.dto';

@ApiTags('Media')
@Controller('media/files')
export class MediaController {
  constructor(
    private readonly uploadFileUseCase: UploadFileUseCase,
    private readonly initiateUploadUseCase: InitiateUploadUseCase,
    private readonly getFileMetadataUseCase: GetFileMetadataUseCase,
    private readonly getPresignedUrlUseCase: GetPresignedUrlUseCase,
    private readonly deleteFileUseCase: DeleteFileUseCase,
    private readonly listFilesUseCase: ListFilesUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'Upload file trực tiếp lên server (file bytes đi qua server)',
  })
  @ApiHeader({
    name: 'x-user-id',
    description: 'Injected by Kong after JWT validation',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-user-id') uploadedById: string,
  ): Promise<FileObjectResponseDto> {
    if (!file) throw new BadRequestException('No file provided');
    const result = await this.uploadFileUseCase.execute(
      new UploadFileCommand(
        file.buffer,
        file.originalname,
        file.mimetype,
        file.size,
        uploadedById,
      ),
    );
    return FileObjectResponseDto.fromResult(result);
  }

  @Post('init')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Khởi tạo direct upload — trả về SAS URL để client PUT file thẳng lên Azure (file không đi qua server)',
    description:
      'Flow:\n' +
      '1. Gọi endpoint này → nhận `{ mediaFileId, uploadUrl, publicUrl, expiresAt }`\n' +
      '2. Client PUT file lên `uploadUrl` với header `x-ms-blob-type: BlockBlob`\n' +
      '3. Gọi user-service / course-service với `mediaFileId` và `publicUrl` (làm avatarUrl / fileUrl)',
  })
  @ApiHeader({
    name: 'x-user-id',
    description: 'Injected by Kong after JWT validation',
  })
  async initiateUpload(
    @Headers('x-user-id') uploadedById: string,
    @Body() dto: InitiateUploadRequestDto,
  ): Promise<InitiateUploadResponseDto> {
    const result = await this.initiateUploadUseCase.execute(
      new InitiateUploadCommand(
        dto.originalName,
        dto.mimeType,
        dto.fileSize,
        uploadedById,
      ),
    );
    return InitiateUploadResponseDto.fromResult(result);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách file đã upload (có filter)' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'Injected by Kong after JWT validation',
  })
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

  @Get(':id')
  @ApiOperation({ summary: 'Lấy metadata của file theo ID' })
  async getFileMetadata(
    @Param('id') id: string,
  ): Promise<FileObjectResponseDto> {
    const result = await this.getFileMetadataUseCase.execute(
      new GetFileMetadataQuery(id),
    );
    return FileObjectResponseDto.fromResult(result);
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'Lấy presigned download URL (hết hạn sau 1 giờ)' })
  async getPresignedUrl(
    @Param('id') id: string,
  ): Promise<PresignedUrlResponseDto> {
    const result = await this.getPresignedUrlUseCase.execute(
      new GetPresignedUrlQuery(id),
    );
    return PresignedUrlResponseDto.fromResult(result);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa file khỏi storage và database' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'Injected by Kong after JWT validation',
  })
  async deleteFile(
    @Param('id') id: string,
    @Headers('x-user-id') deletedById: string,
  ): Promise<void> {
    await this.deleteFileUseCase.execute(
      new DeleteFileCommand(id, deletedById),
    );
  }
}
