import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const turboCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const localEnv = loadLocalEnvFile();
const devConcurrency =
  process.env.DEV_CONCURRENCY ?? localEnv.DEV_CONCURRENCY ?? '12';
const env: NodeJS.ProcessEnv = {
  ...process.env,
  CONSUL_URL:
    process.env.CONSUL_URL || localEnv.CONSUL_URL || 'http://127.0.0.1:8500',
  LOGSTASH_ENABLED: process.env.LOGSTASH_ENABLED ?? 'false',
  NODE_ENV: 'development-local',
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    localEnv.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    'http://localhost:4318/v1/traces',
  OTEL_PROPAGATORS:
    process.env.OTEL_PROPAGATORS ??
    localEnv.OTEL_PROPAGATORS ??
    'tracecontext,baggage',
  OTEL_TRACING_ENABLED:
    process.env.OTEL_TRACING_ENABLED ??
    localEnv.OTEL_TRACING_ENABLED ??
    'false',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
};

if (env.LOGSTASH_ENABLED === 'true') {
  env.LOGSTASH_HOST =
    process.env.LOGSTASH_HOST ?? localEnv.LOGSTASH_HOST ?? '127.0.0.1';
  env.LOGSTASH_PORT =
    process.env.LOGSTASH_PORT ?? localEnv.LOGSTASH_PORT ?? '5044';
} else {
  delete env.LOGSTASH_HOST;
  delete env.LOGSTASH_PORT;
}

function loadLocalEnvFile(): Record<string, string> {
  const envFile = path.join(__dirname, '../.env');
  if (!fs.existsSync(envFile)) {
    return {};
  }

  const values: Record<string, string> = {};
  const lines = fs.readFileSync(envFile, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

const result = spawnSync(
  turboCommand,
  [
    'turbo',
    'run',
    'start:dev',
    '--filter=./apps/*',
    `--concurrency=${devConcurrency}`,
    '--env-mode=loose',
  ],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
