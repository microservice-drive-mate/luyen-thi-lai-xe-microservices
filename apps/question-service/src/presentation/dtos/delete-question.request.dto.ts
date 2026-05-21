import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class DeleteQuestionRequestDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  version: number;
}
