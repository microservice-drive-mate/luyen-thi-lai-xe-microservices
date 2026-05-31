import { execSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type WorkflowRun = {
  id: number;
  name: string | null;
  display_title: string;
  event: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  run_started_at?: string | null;
  head_branch: string | null;
  head_sha: string;
  html_url: string;
};

type WorkflowRunsResponse = {
  workflow_runs: WorkflowRun[];
};

type CommitResponse = {
  commit?: {
    author?: {
      date?: string;
    };
    committer?: {
      date?: string;
    };
  };
};

type GitHubIssue = {
  number: number;
  title: string;
  state: string;
  created_at: string;
  closed_at: string | null;
  html_url: string;
  pull_request?: unknown;
  labels: Array<string | { name?: string | null }>;
};

type IncidentRecord = {
  id?: string;
  title: string;
  environment?: string;
  severity?: string;
  startedAt: string;
  resolvedAt?: string;
  causedByDeploySha?: string;
  labels?: string[];
  url?: string;
};

type Incident = {
  id: string;
  title: string;
  environment: string;
  severity: string;
  startedAt: Date;
  resolvedAt?: Date;
  labels: string[];
  url?: string;
};

type DeploymentEventRecord = {
  schemaVersion?: number;
  eventId?: string;
  source?: string;
  provider?: string;
  repository?: string;
  workflow?: string;
  workflowRunId?: string;
  workflowRunAttempt?: string;
  job?: string;
  environment?: string;
  deploymentType?: string;
  deploymentTarget?: string;
  releaseName?: string;
  namespace?: string;
  gitSha?: string;
  imageTag?: string;
  branch?: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string;
  deployUrl?: string;
  actor?: string;
  trigger?: string;
  rollbackOf?: string;
  smokeStatus?: string;
  metadata?: Record<string, unknown>;
};

type Deployment = {
  id: number | string;
  eventId?: string;
  source: string;
  workflow: string;
  workflowRunId?: string;
  workflowRunAttempt?: string;
  environment: string;
  event: string;
  branch: string;
  sha: string;
  imageTag: string;
  conclusion: string;
  startedAt: Date;
  finishedAt: Date;
  url: string;
  leadTimeMs?: number;
};

const now = new Date();
const days = Number(process.env.DORA_DAYS ?? '30');
const maxPages = Number(process.env.DORA_MAX_PAGES ?? '10');
const maxLeadTimeSamples = Number(
  process.env.DORA_MAX_LEAD_TIME_SAMPLES ?? '50',
);
const repository =
  process.env.DORA_REPOSITORY ??
  process.env.GITHUB_REPOSITORY ??
  detectRepository();
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const outputPath = process.env.DORA_OUTPUT ?? 'reports/dora/dora-report.md';
const jsonOutputPath =
  process.env.DORA_JSON_OUTPUT ?? outputPath.replace(/\.md$/i, '.json');
const deploymentEventsDir =
  process.env.DORA_DEPLOYMENT_EVENTS_DIR ?? 'reports/deployments';
const deployWorkflowNames = parseCsv(
  process.env.DORA_DEPLOY_WORKFLOWS ??
    'Main Image Release,Production Release,Legacy SSH Compose Deploy',
);
const incidentLabels = parseCsv(process.env.DORA_INCIDENT_LABELS ?? 'incident');
const localIncidentsFile = process.env.DORA_INCIDENTS_FILE;
const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

async function main(): Promise<void> {
  if (!repository) {
    throw new Error(
      'Missing repository. Set GITHUB_REPOSITORY or DORA_REPOSITORY as owner/name.',
    );
  }

  const eventDeployments = await listDeploymentEvents();
  let workflowDeployments: Deployment[] = [];

  try {
    const workflowRuns = await listWorkflowRuns();
    workflowDeployments = workflowRuns
      .filter((run) => isDeployWorkflow(run.name ?? ''))
      .map(toDeployment);
  } catch (error) {
    console.warn(
      `[dora-report] Cannot read GitHub Actions runs: ${formatError(error)}`,
    );
  }

  const deployments = mergeDeployments([
    ...eventDeployments,
    ...workflowDeployments,
  ]).sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());

  await hydrateLeadTimes(deployments);

  let incidents: Incident[] = [];
  try {
    incidents = await listIncidents();
  } catch (error) {
    console.warn(
      `[dora-report] Cannot read incident issues: ${formatError(error)}`,
    );
  }
  const report = buildMarkdownReport(deployments, incidents);
  const jsonReport = buildJsonReport(deployments, incidents);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, report, 'utf8');
  await mkdir(path.dirname(jsonOutputPath), { recursive: true });
  await writeFile(jsonOutputPath, JSON.stringify(jsonReport, null, 2), 'utf8');

  console.log(`[dora-report] Wrote ${outputPath}`);
  console.log(`[dora-report] Wrote ${jsonOutputPath}`);
}

async function listWorkflowRuns(): Promise<WorkflowRun[]> {
  const allRuns: WorkflowRun[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await githubGet<WorkflowRunsResponse>(
      `/actions/runs?per_page=100&page=${page}`,
    );
    const runs = response.workflow_runs ?? [];
    allRuns.push(...runs);

    if (runs.length < 100) {
      break;
    }
  }

  return allRuns.filter((run) => new Date(run.created_at) >= fromDate);
}

async function listDeploymentEvents(): Promise<Deployment[]> {
  const files = await findJsonFiles(deploymentEventsDir);
  const deployments: Deployment[] = [];

  for (const file of files) {
    try {
      const raw = await readFile(file, 'utf8');
      const parsed = JSON.parse(raw) as DeploymentEventRecord;
      const deployment = toDeploymentFromEvent(parsed, file);

      if (deployment.finishedAt >= fromDate) {
        deployments.push(deployment);
      }
    } catch (error) {
      console.warn(
        `[dora-report] Cannot read deployment event ${file}: ${formatError(error)}`,
      );
    }
  }

  return deployments;
}

async function findJsonFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          return findJsonFiles(entryPath);
        }

        if (entry.isFile() && entry.name.endsWith('.json')) {
          return [entryPath];
        }

        return [];
      }),
    );

    return files.flat();
  } catch (error) {
    if (isFileNotFound(error)) {
      return [];
    }

    throw error;
  }
}

async function listIncidents(): Promise<Incident[]> {
  const incidents: Incident[] = [];

  if (localIncidentsFile) {
    incidents.push(...(await readLocalIncidents(localIncidentsFile)));
  }

  for (const label of incidentLabels) {
    const encodedLabel = encodeURIComponent(label);
    const since = encodeURIComponent(fromDate.toISOString());
    const response = await githubGet<GitHubIssue[]>(
      `/issues?state=all&labels=${encodedLabel}&since=${since}&per_page=100`,
    );

    for (const issue of response) {
      if (issue.pull_request) {
        continue;
      }

      const labels = normalizeLabels(issue.labels);
      incidents.push({
        id: `#${issue.number}`,
        title: issue.title,
        environment: inferIncidentEnvironment(labels),
        severity: inferIncidentSeverity(labels),
        startedAt: new Date(issue.created_at),
        resolvedAt: issue.closed_at ? new Date(issue.closed_at) : undefined,
        labels,
        url: issue.html_url,
      });
    }
  }

  return dedupeIncidents(incidents).sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );
}

async function readLocalIncidents(filePath: string): Promise<Incident[]> {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as
    | IncidentRecord[]
    | { incidents: IncidentRecord[] };
  const records = Array.isArray(parsed) ? parsed : (parsed.incidents ?? []);

  return records.map((record, index) => ({
    id: record.id ?? `local-${index + 1}`,
    title: record.title,
    environment: record.environment ?? 'unknown',
    severity: record.severity ?? inferIncidentSeverity(record.labels ?? []),
    startedAt: new Date(record.startedAt),
    resolvedAt: record.resolvedAt ? new Date(record.resolvedAt) : undefined,
    labels: record.labels ?? [],
    url: record.url,
  }));
}

async function hydrateLeadTimes(deployments: Deployment[]): Promise<void> {
  const successfulDeployments = deployments
    .filter((deployment) => deployment.conclusion === 'success')
    .slice(0, maxLeadTimeSamples);
  const commitDateCache = new Map<string, Date | undefined>();

  for (const deployment of successfulDeployments) {
    if (!looksLikeGitSha(deployment.sha)) {
      continue;
    }

    if (!commitDateCache.has(deployment.sha)) {
      commitDateCache.set(deployment.sha, await getCommitDate(deployment.sha));
    }

    const commitDate = commitDateCache.get(deployment.sha);
    if (!commitDate) {
      continue;
    }

    deployment.leadTimeMs =
      deployment.finishedAt.getTime() - commitDate.getTime();
  }
}

async function getCommitDate(sha: string): Promise<Date | undefined> {
  try {
    const response = await githubGet<CommitResponse>(`/commits/${sha}`);
    const date =
      response.commit?.committer?.date ?? response.commit?.author?.date;
    return date ? new Date(date) : undefined;
  } catch (error) {
    console.warn(
      `[dora-report] Cannot read commit ${sha.slice(0, 12)}: ${formatError(error)}`,
    );
    return undefined;
  }
}

async function githubGet<T>(apiPath: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${repository}${apiPath}`,
    {
      headers,
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub API ${apiPath} -> HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  return (await response.json()) as T;
}

function buildMarkdownReport(
  deployments: Deployment[],
  incidents: Incident[],
): string {
  const successfulDeployments = deployments.filter(
    (deployment) => deployment.conclusion === 'success',
  );
  const failedDeployments = deployments.filter((deployment) =>
    isFailedDeployConclusion(deployment.conclusion),
  );
  const cancelledDeployments = deployments.filter(
    (deployment) => deployment.conclusion === 'cancelled',
  );
  const leadTimes = successfulDeployments
    .map((deployment) => deployment.leadTimeMs)
    .filter(
      (value): value is number => typeof value === 'number' && value >= 0,
    );
  const resolvedIncidents = incidents.filter(isResolvedIncident);
  const mttrs = resolvedIncidents.map(
    (incident) => incident.resolvedAt.getTime() - incident.startedAt.getTime(),
  );
  const changeFailureIncidents = incidents.filter((incident) =>
    incident.labels.some((label) =>
      ['change-failure', 'deploy-failure', 'rollback'].includes(label),
    ),
  );
  const sev1Incidents = incidents.filter(
    (incident) => incident.severity === 'sev1',
  );
  const sev2Incidents = incidents.filter(
    (incident) => incident.severity === 'sev2',
  );
  const needsPostmortemIncidents = incidents.filter((incident) =>
    incident.labels.includes('needs-postmortem'),
  );
  const changeFailureSignals =
    failedDeployments.length + changeFailureIncidents.length;
  const changeFailureRate =
    deployments.length > 0
      ? changeFailureSignals / deployments.length
      : undefined;
  const deploymentsPerWeek =
    successfulDeployments.length / Math.max(days / 7, 1);
  const deploymentFrequency = successfulDeployments.length / Math.max(days, 1);
  const avgLeadTime = average(leadTimes);
  const avgMttr = average(mttrs);

  const lines: string[] = [
    '# Báo cáo DORA DevOps',
    '',
    `- Repository: \`${repository}\``,
    `- Khoảng thời gian: ${days} ngày gần nhất, từ ${formatDate(fromDate)} đến ${formatDate(now)}`,
    `- Workflow deploy được tính: ${deployWorkflowNames.map((name) => `\`${name}\``).join(', ')}`,
    `- Deployment event store: \`${deploymentEventsDir}\``,
    `- Tạo lúc: ${formatDateTime(now)}`,
    '',
    '## Tổng quan',
    '',
    '| Chỉ số | Giá trị | Mức theo DORA | Ghi chú |',
    '| --- | ---: | --- | --- |',
    `| Deployment Frequency | ${formatNumber(deploymentsPerWeek)} deploy/tuần | ${classifyDeploymentFrequency(deploymentFrequency)} | ${successfulDeployments.length} deploy thành công / ${deployments.length} lần deploy |`,
    `| Lead Time for Changes | ${formatDuration(avgLeadTime)} | ${classifyLeadTime(avgLeadTime)} | Tính từ commit time đến workflow deploy hoàn tất |`,
    `| MTTR | ${formatDuration(avgMttr)} | ${classifyMttr(avgMttr)} | Tính từ issue \`incident\` được tạo đến khi đóng issue |`,
    `| Change Failure Rate | ${formatPercent(changeFailureRate)} | ${classifyChangeFailureRate(changeFailureRate)} | Proxy = deploy workflow fail + incident có label change-failure/deploy-failure/rollback |`,
    '',
    '## Dữ liệu deployment',
    '',
    `- Tổng lần deploy workflow: ${deployments.length}`,
    `- Thành công: ${successfulDeployments.length}`,
    `- Thất bại/timeout/action required: ${failedDeployments.length}`,
    `- Bị hủy thủ công: ${cancelledDeployments.length}`,
    `- Trung bình mỗi ngày: ${formatNumber(deploymentFrequency)} deploy/ngày`,
    '',
    '| Thời gian | Nguồn | Workflow | Môi trường | Kết quả | Branch | SHA/Image | Link |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...deployments
      .slice(0, 20)
      .map((deployment) =>
        [
          formatDateTime(deployment.finishedAt),
          deployment.source,
          deployment.workflow,
          deployment.environment,
          deployment.conclusion,
          deployment.branch,
          deployment.imageTag || deployment.sha.slice(0, 12),
          deployment.url ? `[run](${deployment.url})` : '-',
        ].join(' | '),
      )
      .map((row) => `| ${row} |`),
    deployments.length === 0
      ? '| Chưa có dữ liệu | - | - | - | - | - | - | - |'
      : '',
    '',
    '## Dữ liệu incident',
    '',
    `- Tổng incident: ${incidents.length}`,
    `- Đã resolve: ${resolvedIncidents.length}`,
    `- SEV1/SEV2: ${sev1Incidents.length + sev2Incidents.length}`,
    `- Cần postmortem: ${needsPostmortemIncidents.length}`,
    `- Incident liên quan change failure/rollback: ${changeFailureIncidents.length}`,
    '',
    '| Bắt đầu | Kết thúc | MTTR | Môi trường | Severity | Labels | Tiêu đề |',
    '| --- | --- | ---: | --- | --- | --- | --- |',
    ...incidents.slice(0, 20).map((incident) => {
      const mttr = incident.resolvedAt
        ? incident.resolvedAt.getTime() - incident.startedAt.getTime()
        : undefined;
      const title = incident.url
        ? `[${escapePipes(incident.title)}](${incident.url})`
        : escapePipes(incident.title);

      return `| ${formatDateTime(incident.startedAt)} | ${
        incident.resolvedAt ? formatDateTime(incident.resolvedAt) : 'Đang mở'
      } | ${formatDuration(mttr)} | ${incident.environment} | ${
        incident.severity
      } | ${incident.labels.join(', ') || '-'} | ${title} |`;
    }),
    incidents.length === 0 ? '| Chưa có dữ liệu | - | - | - | - | - | - |' : '',
    '',
    '## Nhận xét nhanh',
    '',
    ...buildRecommendations({
      deployments,
      successfulDeployments,
      failedDeployments,
      incidents,
      leadTimes,
      mttrs,
      changeFailureRate,
    }),
    '',
    '## Cách đọc báo cáo',
    '',
    '- Deployment Frequency cao cho thấy team có khả năng phát hành thường xuyên.',
    '- Lead Time for Changes thấp cho thấy pipeline và quy trình review/deploy đang gọn.',
    '- MTTR thấp cho thấy khả năng phát hiện và khôi phục incident tốt.',
    '- Change Failure Rate thấp cho thấy deploy ít gây lỗi production.',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function buildJsonReport(deployments: Deployment[], incidents: Incident[]) {
  const successfulDeployments = deployments.filter(
    (deployment) => deployment.conclusion === 'success',
  );
  const failedDeployments = deployments.filter((deployment) =>
    isFailedDeployConclusion(deployment.conclusion),
  );
  const leadTimes = successfulDeployments
    .map((deployment) => deployment.leadTimeMs)
    .filter(
      (value): value is number => typeof value === 'number' && value >= 0,
    );
  const resolvedIncidents = incidents.filter(isResolvedIncident);
  const mttrs = resolvedIncidents.map(
    (incident) => incident.resolvedAt.getTime() - incident.startedAt.getTime(),
  );
  const changeFailureIncidents = incidents.filter((incident) =>
    incident.labels.some((label) =>
      ['change-failure', 'deploy-failure', 'rollback'].includes(label),
    ),
  );
  const sev1Incidents = incidents.filter(
    (incident) => incident.severity === 'sev1',
  );
  const sev2Incidents = incidents.filter(
    (incident) => incident.severity === 'sev2',
  );
  const needsPostmortemIncidents = incidents.filter((incident) =>
    incident.labels.includes('needs-postmortem'),
  );
  const changeFailureSignals =
    failedDeployments.length + changeFailureIncidents.length;

  return {
    repository,
    generatedAt: now.toISOString(),
    from: fromDate.toISOString(),
    to: now.toISOString(),
    days,
    deployWorkflows: deployWorkflowNames,
    summary: {
      deployments: deployments.length,
      successfulDeployments: successfulDeployments.length,
      failedDeployments: failedDeployments.length,
      deploymentsPerDay: successfulDeployments.length / Math.max(days, 1),
      deploymentsPerWeek: successfulDeployments.length / Math.max(days / 7, 1),
      averageLeadTimeMs: average(leadTimes),
      incidents: incidents.length,
      resolvedIncidents: resolvedIncidents.length,
      sev1Incidents: sev1Incidents.length,
      sev2Incidents: sev2Incidents.length,
      needsPostmortemIncidents: needsPostmortemIncidents.length,
      averageMttrMs: average(mttrs),
      changeFailureSignals,
      changeFailureRate:
        deployments.length > 0
          ? changeFailureSignals / deployments.length
          : null,
    },
    deployments: deployments.map((deployment) => ({
      ...deployment,
      startedAt: deployment.startedAt.toISOString(),
      finishedAt: deployment.finishedAt.toISOString(),
    })),
    incidents: incidents.map((incident) => ({
      ...incident,
      startedAt: incident.startedAt.toISOString(),
      resolvedAt: incident.resolvedAt?.toISOString(),
    })),
  };
}

function buildRecommendations(input: {
  deployments: Deployment[];
  successfulDeployments: Deployment[];
  failedDeployments: Deployment[];
  incidents: Incident[];
  leadTimes: number[];
  mttrs: number[];
  changeFailureRate: number | undefined;
}): string[] {
  const recommendations: string[] = [];

  if (input.deployments.length === 0) {
    recommendations.push(
      '- Chưa có deployment data trong khoảng thời gian này. Hãy chạy workflow deploy hoặc tăng `DORA_DAYS`.',
    );
  }

  if (input.leadTimes.length === 0) {
    recommendations.push(
      '- Chưa tính được lead time. Kiểm tra quyền `contents: read` và commit SHA của workflow run.',
    );
  }

  if (input.incidents.length === 0) {
    recommendations.push(
      '- Chưa có incident issue. Khi có sự cố, tạo issue bằng template Incident để tính MTTR.',
    );
  }

  if (input.failedDeployments.length > 0) {
    recommendations.push(
      '- Có deploy workflow fail/timeout/action required. Nên xem lại run log và đánh dấu nếu deploy này gây incident production.',
    );
  }

  if (
    typeof input.changeFailureRate === 'number' &&
    input.changeFailureRate > 0.15
  ) {
    recommendations.push(
      '- Change Failure Rate đang vượt ngưỡng Elite 15%. Nên tăng smoke test, rollback rehearsal và canary/manual approval cho production.',
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      '- Các chỉ số đang có tín hiệu tốt. Tiếp tục lưu deployment events và incident issues theo từng release.',
    );
  }

  return recommendations;
}

function isDeployWorkflow(workflowName: string): boolean {
  const normalized = workflowName.trim().toLowerCase();
  return deployWorkflowNames.some(
    (name) => name.trim().toLowerCase() === normalized,
  );
}

function isFailedDeployConclusion(conclusion: string): boolean {
  return ['failure', 'timed_out', 'action_required'].includes(conclusion);
}

function normalizeDeploymentStatus(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'succeeded') {
    return 'success';
  }

  if (normalized === 'failed') {
    return 'failure';
  }

  if (normalized === 'canceled') {
    return 'cancelled';
  }

  if (normalized === 'timeout') {
    return 'timed_out';
  }

  return normalized || 'unknown';
}

function looksLikeGitSha(value: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(value);
}

function isResolvedIncident(
  incident: Incident,
): incident is Incident & { resolvedAt: Date } {
  return incident.resolvedAt instanceof Date;
}

function toDeployment(run: WorkflowRun): Deployment {
  return {
    id: run.id,
    source: 'github-actions-history',
    workflow: run.name ?? 'unknown',
    workflowRunId: String(run.id),
    environment: inferEnvironment(run),
    event: run.event,
    branch: run.head_branch ?? 'unknown',
    sha: run.head_sha,
    imageTag: run.head_sha,
    conclusion: run.conclusion ?? run.status,
    startedAt: new Date(run.run_started_at ?? run.created_at),
    finishedAt: new Date(run.updated_at),
    url: run.html_url,
  };
}

function toDeploymentFromEvent(
  record: DeploymentEventRecord,
  filePath: string,
): Deployment {
  const finishedAt = new Date(record.finishedAt ?? record.startedAt ?? now);
  const startedAt = new Date(
    record.startedAt ?? record.finishedAt ?? finishedAt,
  );
  const sha = record.gitSha || record.imageTag || '';

  return {
    id: record.eventId ?? filePath,
    eventId: record.eventId,
    source: record.source ?? record.provider ?? 'deployment-event',
    workflow: record.workflow ?? 'unknown',
    workflowRunId: record.workflowRunId,
    workflowRunAttempt: record.workflowRunAttempt,
    environment: record.environment ?? 'unknown',
    event: record.trigger ?? 'deployment_event',
    branch: record.branch ?? 'unknown',
    sha,
    imageTag: record.imageTag ?? sha,
    conclusion: normalizeDeploymentStatus(record.status ?? 'unknown'),
    startedAt,
    finishedAt,
    url: record.deployUrl ?? '',
  };
}

function mergeDeployments(deployments: Deployment[]): Deployment[] {
  const merged = new Map<string, Deployment>();

  for (const deployment of deployments) {
    const key = deployment.workflowRunId
      ? `${deployment.workflowRunId}:${deployment.environment}`
      : `${deployment.source}:${deployment.id}:${deployment.environment}`;
    const existing = merged.get(key);

    if (!existing || existing.source === 'github-actions-history') {
      merged.set(key, deployment);
    }
  }

  return [...merged.values()];
}

function inferEnvironment(run: WorkflowRun): string {
  const name = `${run.name ?? ''} ${run.display_title}`.toLowerCase();

  if (name.includes('production')) {
    return 'production';
  }

  if (name.includes('staging')) {
    return 'staging';
  }

  if (name.includes('main image release')) {
    return 'staging';
  }

  const match = name.match(/\bto\s+([a-z0-9_-]+)/);
  return match?.[1] ?? 'unknown';
}

function normalizeLabels(labels: GitHubIssue['labels']): string[] {
  return labels
    .map((label) => (typeof label === 'string' ? label : (label.name ?? '')))
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean);
}

function inferIncidentEnvironment(labels: string[]): string {
  for (const environment of ['production', 'staging', 'local']) {
    if (labels.includes(environment)) {
      return environment;
    }
  }

  return 'unknown';
}

function inferIncidentSeverity(labels: string[]): string {
  for (const severity of ['sev1', 'sev2', 'sev3', 'sev4']) {
    if (labels.includes(severity)) {
      return severity;
    }
  }

  return 'unknown';
}

function dedupeIncidents(incidents: Incident[]): Incident[] {
  const seen = new Set<string>();
  const unique: Incident[] = [];

  for (const incident of incidents) {
    const key = incident.url ?? incident.id;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(incident);
  }

  return unique;
}

function average(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function classifyDeploymentFrequency(deploymentsPerDay: number): string {
  if (deploymentsPerDay >= 1) {
    return 'High/Elite';
  }
  if (deploymentsPerDay >= 1 / 7) {
    return 'High';
  }
  if (deploymentsPerDay >= 1 / 30) {
    return 'Medium';
  }
  return 'Low';
}

function classifyLeadTime(ms: number | undefined): string {
  if (typeof ms !== 'number') {
    return 'Chưa đủ dữ liệu';
  }

  const daysValue = ms / (24 * 60 * 60 * 1000);
  if (daysValue < 1) {
    return 'Elite';
  }
  if (daysValue <= 7) {
    return 'High';
  }
  if (daysValue <= 30) {
    return 'Medium';
  }
  return 'Low';
}

function classifyMttr(ms: number | undefined): string {
  if (typeof ms !== 'number') {
    return 'Chưa đủ dữ liệu';
  }

  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) {
    return 'Elite';
  }
  if (hours <= 24) {
    return 'High';
  }
  if (hours <= 168) {
    return 'Medium';
  }
  return 'Low';
}

function classifyChangeFailureRate(rate: number | undefined): string {
  if (typeof rate !== 'number') {
    return 'Chưa đủ dữ liệu';
  }

  if (rate <= 0.15) {
    return 'Elite';
  }
  if (rate <= 0.3) {
    return 'High';
  }
  if (rate <= 0.45) {
    return 'Medium';
  }
  return 'Low';
}

function formatDuration(ms: number | undefined): string {
  if (typeof ms !== 'number' || Number.isNaN(ms)) {
    return 'N/A';
  }

  const minutes = Math.round(ms / 60000);
  if (minutes < 60) {
    return `${minutes} phút`;
  }

  const hours = minutes / 60;
  if (hours < 48) {
    return `${formatNumber(hours)} giờ`;
  }

  return `${formatNumber(hours / 24)} ngày`;
}

function formatPercent(value: number | undefined): string {
  if (typeof value !== 'number') {
    return 'N/A';
  }

  return `${formatNumber(value * 100)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date: Date): string {
  return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

function escapePipes(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function detectRepository(): string | undefined {
  try {
    const remote = execSync('git config --get remote.origin.url', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/i);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isFileNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

void main().catch((error) => {
  console.error(`[dora-report] ${formatError(error)}`);
  process.exitCode = 1;
});
