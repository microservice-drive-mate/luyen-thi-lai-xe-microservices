import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type DoraSummary = {
  deployments?: number;
  successfulDeployments?: number;
  failedDeployments?: number;
  deploymentsPerDay?: number;
  deploymentsPerWeek?: number;
  averageLeadTimeMs?: number | null;
  incidents?: number;
  resolvedIncidents?: number;
  sev1Incidents?: number;
  sev2Incidents?: number;
  needsPostmortemIncidents?: number;
  averageMttrMs?: number | null;
  changeFailureSignals?: number;
  changeFailureRate?: number | null;
};

type DoraDeployment = {
  source?: string;
  workflow?: string;
  environment?: string;
  conclusion?: string;
  finishedAt?: string;
  leadTimeMs?: number;
};

type DoraIncident = {
  environment?: string;
  severity?: string;
  resolvedAt?: string;
};

type DoraReport = {
  repository?: string;
  generatedAt?: string;
  from?: string;
  to?: string;
  days?: number;
  summary?: DoraSummary;
  deployments?: DoraDeployment[];
  incidents?: DoraIncident[];
};

const inputPath =
  process.env.DORA_JSON_OUTPUT ?? 'reports/dora/dora-report.json';
const outputPath = process.env.DORA_PROM_OUTPUT ?? 'reports/dora/dora.prom';

async function main(): Promise<void> {
  const report = JSON.parse(await readFile(inputPath, 'utf8')) as DoraReport;
  const metrics = buildPrometheusMetrics(report);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, metrics, 'utf8');

  console.log(`[dora-prometheus-export] Wrote ${outputPath}`);
}

function buildPrometheusMetrics(report: DoraReport): string {
  const repository = report.repository ?? 'unknown';
  const summary = report.summary ?? {};
  const deployments = report.deployments ?? [];
  const incidents = report.incidents ?? [];
  const labels = { repository };
  const lines: string[] = [
    '# HELP dora_report_info Thông tin report DORA gần nhất.',
    '# TYPE dora_report_info gauge',
    metric('dora_report_info', 1, {
      repository,
      from: report.from ?? '',
      to: report.to ?? '',
      days: String(report.days ?? ''),
    }),
    '# HELP dora_report_generated_timestamp_seconds Thời điểm tạo report DORA gần nhất, Unix timestamp.',
    '# TYPE dora_report_generated_timestamp_seconds gauge',
    metric(
      'dora_report_generated_timestamp_seconds',
      toTimestampSeconds(report.generatedAt),
      labels,
    ),
    '# HELP dora_deployments_total Tổng số lần deploy được DORA report ghi nhận.',
    '# TYPE dora_deployments_total gauge',
    metric('dora_deployments_total', summary.deployments, labels),
    '# HELP dora_successful_deployments_total Tổng số lần deploy thành công.',
    '# TYPE dora_successful_deployments_total gauge',
    metric(
      'dora_successful_deployments_total',
      summary.successfulDeployments,
      labels,
    ),
    '# HELP dora_failed_deployments_total Tổng số lần deploy thất bại hoặc cần xử lý.',
    '# TYPE dora_failed_deployments_total gauge',
    metric('dora_failed_deployments_total', summary.failedDeployments, labels),
    '# HELP dora_deployments_per_day Số lần deploy thành công trung bình mỗi ngày.',
    '# TYPE dora_deployments_per_day gauge',
    metric('dora_deployments_per_day', summary.deploymentsPerDay, labels),
    '# HELP dora_deployments_per_week Số lần deploy thành công trung bình mỗi tuần.',
    '# TYPE dora_deployments_per_week gauge',
    metric('dora_deployments_per_week', summary.deploymentsPerWeek, labels),
    '# HELP dora_average_lead_time_seconds Lead Time for Changes trung bình, tính bằng giây.',
    '# TYPE dora_average_lead_time_seconds gauge',
    metric(
      'dora_average_lead_time_seconds',
      millisecondsToSeconds(summary.averageLeadTimeMs),
      labels,
    ),
    '# HELP dora_lead_time_samples_total Số deployment có dữ liệu lead time hợp lệ.',
    '# TYPE dora_lead_time_samples_total gauge',
    metric(
      'dora_lead_time_samples_total',
      deployments.filter(
        (deployment) => typeof deployment.leadTimeMs === 'number',
      ).length,
      labels,
    ),
    '# HELP dora_incidents_total Tổng số incident được DORA report ghi nhận.',
    '# TYPE dora_incidents_total gauge',
    metric('dora_incidents_total', summary.incidents, labels),
    '# HELP dora_resolved_incidents_total Tổng số incident đã resolve.',
    '# TYPE dora_resolved_incidents_total gauge',
    metric('dora_resolved_incidents_total', summary.resolvedIncidents, labels),
    '# HELP dora_sev1_incidents_total Tổng số incident SEV1.',
    '# TYPE dora_sev1_incidents_total gauge',
    metric('dora_sev1_incidents_total', summary.sev1Incidents, labels),
    '# HELP dora_sev2_incidents_total Tổng số incident SEV2.',
    '# TYPE dora_sev2_incidents_total gauge',
    metric('dora_sev2_incidents_total', summary.sev2Incidents, labels),
    '# HELP dora_needs_postmortem_incidents_total Tổng số incident cần postmortem.',
    '# TYPE dora_needs_postmortem_incidents_total gauge',
    metric(
      'dora_needs_postmortem_incidents_total',
      summary.needsPostmortemIncidents,
      labels,
    ),
    '# HELP dora_average_mttr_seconds MTTR trung bình, tính bằng giây.',
    '# TYPE dora_average_mttr_seconds gauge',
    metric(
      'dora_average_mttr_seconds',
      millisecondsToSeconds(summary.averageMttrMs),
      labels,
    ),
    '# HELP dora_mttr_samples_total Số incident đã resolve dùng để tính MTTR.',
    '# TYPE dora_mttr_samples_total gauge',
    metric(
      'dora_mttr_samples_total',
      incidents.filter((incident) => Boolean(incident.resolvedAt)).length,
      labels,
    ),
    '# HELP dora_change_failure_signals_total Tổng số tín hiệu change failure.',
    '# TYPE dora_change_failure_signals_total gauge',
    metric(
      'dora_change_failure_signals_total',
      summary.changeFailureSignals,
      labels,
    ),
    '# HELP dora_change_failure_rate Tỷ lệ change failure, dạng số từ 0 đến 1.',
    '# TYPE dora_change_failure_rate gauge',
    metric('dora_change_failure_rate', summary.changeFailureRate, labels),
    '# HELP dora_deployment_status_total Số deployment theo trạng thái, môi trường và nguồn.',
    '# TYPE dora_deployment_status_total gauge',
    ...groupDeploymentsByStatus(deployments, repository).map(
      ([groupLabels, value]) =>
        metric('dora_deployment_status_total', value, groupLabels),
    ),
    '# HELP dora_latest_deployment_timestamp_seconds Thời điểm deploy gần nhất theo môi trường, trạng thái và nguồn.',
    '# TYPE dora_latest_deployment_timestamp_seconds gauge',
    ...groupLatestDeployments(deployments, repository).map(
      ([groupLabels, value]) =>
        metric('dora_latest_deployment_timestamp_seconds', value, groupLabels),
    ),
    '# HELP dora_incident_severity_total Số incident theo severity và môi trường.',
    '# TYPE dora_incident_severity_total gauge',
    ...groupIncidentsBySeverity(incidents, repository).map(
      ([groupLabels, value]) =>
        metric('dora_incident_severity_total', value, groupLabels),
    ),
  ];

  return `${lines.join('\n')}\n`;
}

function groupDeploymentsByStatus(
  deployments: DoraDeployment[],
  repository: string,
): Array<[Record<string, string>, number]> {
  const groups = new Map<
    string,
    { labels: Record<string, string>; value: number }
  >();

  for (const deployment of deployments) {
    const labels = {
      repository,
      source: deployment.source ?? 'unknown',
      environment: deployment.environment ?? 'unknown',
      status: deployment.conclusion ?? 'unknown',
    };
    const key = JSON.stringify(labels);
    const group = groups.get(key);

    if (group) {
      group.value += 1;
    } else {
      groups.set(key, { labels, value: 1 });
    }
  }

  return Array.from(groups.values()).map((group) => [
    group.labels,
    group.value,
  ]);
}

function groupLatestDeployments(
  deployments: DoraDeployment[],
  repository: string,
): Array<[Record<string, string>, number]> {
  const groups = new Map<
    string,
    { labels: Record<string, string>; value: number }
  >();

  for (const deployment of deployments) {
    const labels = {
      repository,
      source: deployment.source ?? 'unknown',
      environment: deployment.environment ?? 'unknown',
      status: deployment.conclusion ?? 'unknown',
    };
    const timestamp = toTimestampSeconds(deployment.finishedAt);
    const key = JSON.stringify(labels);
    const group = groups.get(key);

    if (!group || timestamp > group.value) {
      groups.set(key, { labels, value: timestamp });
    }
  }

  return Array.from(groups.values()).map((group) => [
    group.labels,
    group.value,
  ]);
}

function groupIncidentsBySeverity(
  incidents: DoraIncident[],
  repository: string,
): Array<[Record<string, string>, number]> {
  const groups = new Map<
    string,
    { labels: Record<string, string>; value: number }
  >();

  for (const incident of incidents) {
    const labels = {
      repository,
      environment: incident.environment ?? 'unknown',
      severity: incident.severity ?? 'unknown',
    };
    const key = JSON.stringify(labels);
    const group = groups.get(key);

    if (group) {
      group.value += 1;
    } else {
      groups.set(key, { labels, value: 1 });
    }
  }

  return Array.from(groups.values()).map((group) => [
    group.labels,
    group.value,
  ]);
}

function metric(
  name: string,
  value: number | null | undefined,
  labels: Record<string, string>,
): string {
  const serializedLabels = Object.entries(labels)
    .map(([key, labelValue]) => `${key}="${escapeLabelValue(labelValue)}"`)
    .join(',');

  return `${name}{${serializedLabels}} ${toPrometheusNumber(value)}`;
}

function millisecondsToSeconds(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value / 1000 : 0;
}

function toTimestampSeconds(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
}

function toPrometheusNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function escapeLabelValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

main().catch((error) => {
  console.error(`[dora-prometheus-export] ${error.message}`);
  process.exit(1);
});
