import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'nest-keycloak-connect';
import { GetAuditLogUseCase } from '../../application/use-cases/get-audit-log.use-case';
import { ListAuditLogsQuery } from '../../application/use-cases/list-audit-logs.query';
import { ListAuditLogsUseCase } from '../../application/use-cases/list-audit-logs.use-case';
import {
  AuditLogResponseDto,
  ListAuditLogsQueryDto,
  ListAuditLogsResponseDto,
} from '../dtos/audit-log.dtos';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(
    private readonly listAuditLogsUseCase: ListAuditLogsUseCase,
    private readonly getAuditLogUseCase: GetAuditLogUseCase,
  ) {}

  @Get()
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiOperation({ summary: 'Search centralized audit logs' })
  async list(
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<ListAuditLogsResponseDto> {
    const result = await this.listAuditLogsUseCase.execute(
      new ListAuditLogsQuery(
        query.page ?? 1,
        query.size ?? 20,
        query.actorId,
        query.action,
        query.resourceType,
        query.resourceId,
        query.serviceName,
        query.from ? new Date(query.from) : undefined,
        query.to ? new Date(query.to) : undefined,
      ),
    );
    return ListAuditLogsResponseDto.fromResult(result);
  }

  @Get(':id')
  @Roles({ roles: ['realm:ADMIN', 'realm:CENTER_MANAGER'] })
  @ApiOperation({ summary: 'Get audit log detail' })
  async get(@Param('id') id: string): Promise<AuditLogResponseDto> {
    const result = await this.getAuditLogUseCase.execute(id);
    return AuditLogResponseDto.fromRecord(result);
  }
}
