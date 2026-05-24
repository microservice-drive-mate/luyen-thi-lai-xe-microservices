export class ListAuditLogsQuery {
  constructor(
    readonly page: number,
    readonly size: number,
    readonly actorId?: string,
    readonly action?: string,
    readonly resourceType?: string,
    readonly resourceId?: string,
    readonly serviceName?: string,
    readonly from?: Date,
    readonly to?: Date,
  ) {}
}
