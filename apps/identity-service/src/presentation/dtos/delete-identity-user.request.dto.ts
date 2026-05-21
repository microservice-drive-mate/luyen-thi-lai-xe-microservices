import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteIdentityUserRequestDto {
  @ApiPropertyOptional({
    description: 'ID người dùng thực hiện xóa, nếu không gửi sẽ lấy từ JWT.sub',
  })
  @IsOptional()
  @IsString()
  deletedById?: string;
}
