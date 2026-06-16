const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const outputDir =
  process.env.DEPLOYMENT_EVENT_DIR || 'reports/deployments/events';
const environment =
  process.env.DEPLOYMENT_ENVIRONMENT || process.env.DEPLOY_ENV || 'unknown';
const workflow =
  process.env.DEPLOYMENT_WORKFLOW || process.env.GITHUB_WORKFLOW || 'unknown';
const runId = process.env.GITHUB_RUN_ID || 'local';
const runAttempt = process.env.GITHUB_RUN_ATTEMPT || '1';
const eventId =
  process.env.DEPLOYMENT_EVENT_ID ||
  `${runId}-${runAttempt}-${environment}-${Date.now()}`;
const finishedAt =
  process.env.DEPLOYMENT_FINISHED_AT || new Date().toISOString();
const startedAt =
  process.env.DEPLOYMENT_STARTED_AT ||
  process.env.GITHUB_RUN_STARTED_AT ||
  finishedAt;
const repository =
  process.env.GITHUB_REPOSITORY ||
  process.env.DEPLOYMENT_REPOSITORY ||
  'unknown';
const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
const deployUrl =
  process.env.DEPLOYMENT_URL ||
  (repository !== 'unknown' && runId !== 'local'
    ? `${serverUrl}/${repository}/actions/runs/${runId}`
    : '');
const status = normalizeStatus(process.env.DEPLOYMENT_STATUS || 'unknown');
const event = {
  schemaVersion: 1,
  eventId,
  source: process.env.DEPLOYMENT_SOURCE || 'github-actions',
  provider: process.env.DEPLOYMENT_PROVIDER || 'github-actions',
  repository,
  workflow,
  workflowRunId: runId,
  workflowRunAttempt: runAttempt,
  job: process.env.GITHUB_JOB || '',
  environment,
  deploymentType: process.env.DEPLOYMENT_TYPE || 'unknown',
  deploymentTarget: process.env.DEPLOYMENT_TARGET || '',
  releaseName: process.env.DEPLOYMENT_RELEASE_NAME || '',
  namespace: process.env.DEPLOYMENT_NAMESPACE || '',
  gitSha:
    process.env.DEPLOYMENT_GIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.IMAGE_TAG ||
    '',
  imageTag: process.env.DEPLOYMENT_IMAGE_TAG || process.env.IMAGE_TAG || '',
  branch: process.env.GITHUB_REF_NAME || process.env.DEPLOYMENT_BRANCH || '',
  status,
  startedAt,
  finishedAt,
  deployUrl,
  actor: process.env.GITHUB_ACTOR || '',
  trigger: process.env.GITHUB_EVENT_NAME || '',
  rollbackOf: process.env.DEPLOYMENT_ROLLBACK_OF || '',
  smokeStatus: process.env.DEPLOYMENT_SMOKE_STATUS || status,
  metadata: parseMetadata(process.env.DEPLOYMENT_METADATA_JSON),
};
const safeName = eventId.replace(/[^a-zA-Z0-9_.-]+/g, '-');
const outputPath = path.join(outputDir, `${safeName}.json`);

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(event, null, 2)}\n`, 'utf8');
console.log(`[deployment-event] Wrote ${outputPath}`);

function normalizeStatus(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (normalized === 'success' || normalized === 'succeeded') {
    return 'success';
  }

  if (normalized === 'failure' || normalized === 'failed') {
    return 'failure';
  }

  if (
    normalized === 'cancelled' ||
    normalized === 'canceled' ||
    normalized === 'aborted'
  ) {
    return 'cancelled';
  }

  if (normalized === 'unstable') {
    return 'failure';
  }

  if (normalized === 'timed_out' || normalized === 'timeout') {
    return 'timed_out';
  }

  return normalized || 'unknown';
}

function parseMetadata(value) {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error),
      raw: value,
    };
  }
}
