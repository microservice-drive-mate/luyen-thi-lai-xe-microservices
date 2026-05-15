import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteIdentityUserRequestDto {
  @ApiPropertyOptional({
    description: 'User id thuc hien xoa, neu khong gui se lay tu JWT.sub',
  })
  @IsOptional()
  @IsString()
  deletedById?: string;
}
