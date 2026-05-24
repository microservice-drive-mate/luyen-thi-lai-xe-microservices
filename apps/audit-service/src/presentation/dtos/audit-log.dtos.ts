import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Max, Min } from 'class-validator';
import { AuditLogRecord } from '../../domain/repositories/audit-log.repository';

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @Min(1)
  @Max(100)
  size?: number = 20;

  @ApiPropertyOptional() @IsOptional() @IsString() actorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resourceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resourceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceName?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class AuditLogResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() eventId!: string;
  @ApiProperty() serviceName!: string;
  @ApiProperty() actorId!: string;
  @ApiPropertyOptional() actorRole?: string;
  @ApiProperty() action!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty() resourceId!: string;
  @ApiProperty() outcome!: string;
  @ApiProperty() occurredAt!: string;
  @ApiPropertyOptional() correlationId?: string;
  @ApiPropertyOptional() ipAddress?: string;
  @ApiPropertyOptional() userAgent?: string;
  @ApiPropertyOptional() requestPath?: string;
  @ApiPropertyOptional() httpMethod?: string;
  @ApiProperty() metadata!: Record<string, unknown>;
  @ApiProperty() createdAt!: Date;

  static fromRecord(record: AuditLogRecord): AuditLogResponseDto {
    return {
      id: record.id,
      eventId: record.eventId,
      serviceName: record.serviceName,
      actorId: record.actorId,
      actorRole: record.actorRole,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      outcome: record.outcome,
      occurredAt: record.occurredAt,
      correlationId: record.correlationId,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      requestPath: record.requestPath,
      httpMethod: record.httpMethod,
      metadata: record.metadata,
      createdAt: record.createdAt,
    };
  }
}

export class ListAuditLogsResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  items!: AuditLogResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() size!: number;

  static fromResult(result: {
    items: AuditLogRecord[];
    total: number;
    page: number;
    size: number;
  }): ListAuditLogsResponseDto {
    return {
      items: result.items.map(AuditLogResponseDto.fromRecord),
      total: result.total,
      page: result.page,
      size: result.size,
    };
  }
}
