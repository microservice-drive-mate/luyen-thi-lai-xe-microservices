import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { CompleteUploadCommand } from '../../application/use-cases/complete-upload/complete-upload.command';
import { CompleteUploadUseCase } from '../../application/use-cases/complete-upload/complete-upload.use-case';
import { GetFileMetadataQuery } from '../../application/use-cases/get-file-metadata/get-file-metadata.query';
import { GetFileMetadataUseCase } from '../../application/use-cases/get-file-metadata/get-file-metadata.use-case';
import { GetPresignedUrlQuery } from '../../application/use-cases/get-presigned-url/get-presigned-url.query';
import { GetPresignedUrlUseCase } from '../../application/use-cases/get-presigned-url/get-presigned-url.use-case';
import { InitiateUploadCommand } from '../../application/use-cases/initiate-upload/initiate-upload.command';
import { InitiateUploadUseCase } from '../../application/use-cases/initiate-upload/initiate-upload.use-case';
import { UploadFileCommand } from '../../application/use-cases/upload-file/upload-file.command';
import { UploadFileUseCase } from '../../application/use-cases/upload-file/upload-file.use-case';
import { FileObjectResponseDto } from '../dtos/file-object.response.dto';
import { InitiateUploadRequestDto } from '../dtos/initiate-upload.request.dto';
import { InitiateUploadResponseDto } from '../dtos/initiate-upload.response.dto';
import { PresignedUrlResponseDto } from '../dtos/presigned-url.response.dto';

interface JwtPayload {
  sub?: string;
}

function resolveActorId(user: JwtPayload | undefined, headerUserId?: string) {
  return user?.sub ?? headerUserId ?? '';
}

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media/files')
export class MediaController {
  constructor(
    private readonly uploadFileUseCase: UploadFileUseCase,
    private readonly initiateUploadUseCase: InitiateUploadUseCase,
    private readonly completeUploadUseCase: CompleteUploadUseCase,
    private readonly getFileMetadataUseCase: GetFileMetadataUseCase,
    private readonly getPresignedUrlUseCase: GetPresignedUrlUseCase,
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
  @ApiOperation({ summary: 'Upload file through media-service' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
  ): Promise<FileObjectResponseDto> {
    if (!file) throw new BadRequestException('No file provided');

    const result = await this.uploadFileUseCase.execute(
      new UploadFileCommand(
        file.buffer,
        file.originalname,
        file.mimetype,
        file.size,
        resolveActorId(user, headerUserId),
      ),
    );
    return FileObjectResponseDto.fromResult(result);
  }

  @Post('init')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate direct upload and return Azure SAS URL' })
  async initiateUpload(
    @AuthenticatedUser() user: JwtPayload,
    @Headers('x-user-id') headerUserId: string | undefined,
    @Body() dto: InitiateUploadRequestDto,
  ): Promise<InitiateUploadResponseDto> {
    const result = await this.initiateUploadUseCase.execute(
      new InitiateUploadCommand(
        dto.originalName,
        dto.mimeType,
        dto.fileSize,
        resolveActorId(user, headerUserId),
      ),
    );
    return InitiateUploadResponseDto.fromResult(result);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm direct upload completed on Azure Blob' })
  async completeUpload(
    @Param('id') id: string,
  ): Promise<FileObjectResponseDto> {
    const result = await this.completeUploadUseCase.execute(
      new CompleteUploadCommand(id),
    );
    return FileObjectResponseDto.fromResult(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file metadata' })
  async getFileMetadata(
    @Param('id') id: string,
  ): Promise<FileObjectResponseDto> {
    const result = await this.getFileMetadataUseCase.execute(
      new GetFileMetadataQuery(id),
    );
    return FileObjectResponseDto.fromResult(result);
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'Get short-lived download URL' })
  async getPresignedUrl(
    @Param('id') id: string,
  ): Promise<PresignedUrlResponseDto> {
    const result = await this.getPresignedUrlUseCase.execute(
      new GetPresignedUrlQuery(id),
    );
    return PresignedUrlResponseDto.fromResult(result);
  }
}
