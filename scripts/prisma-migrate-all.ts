import axios from 'axios';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

type MigrationMode = 'deploy' | 'dev';

const SERVICES = [
  'identity-service',
  'user-service',
  'course-service',
  'question-service',
  'exam-service',
  'notification-service',
  'analytics-service',
  'simulation-service',
  'media-service',
  'audit-service',
] as const;

const CONSUL_URL = process.env.CONSUL_URL || 'http://127.0.0.1:8500';

function resolveDefaultEnvironment(consulUrl: string): string {
  const normalized = consulUrl.toLowerCase();
  if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
    return 'development-local';
  }

  return 'development';
}

function parseConsulValue(raw: string): string {
  try {
    return String(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function normalizeLocalDatabaseUrl(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
      return parsed.toString();
    }
  } catch {
    // Keep the original value so Prisma can surface a useful error.
  }

  return databaseUrl;
}

async function fetchDatabaseUrl(
  serviceName: string,
  environment: string,
): Promise<string> {
  const key = `config/${environment}/${serviceName}/database.url`;
  const response = await axios.get(`${CONSUL_URL}/v1/kv/${key}`);

  if (!response.data || response.data.length === 0) {
    throw new Error(`Consul key not found: ${key}`);
  }

  const kvData = response.data[0] as { Value: string };
  const raw = Buffer.from(kvData.Value, 'base64').toString('utf-8');
  return normalizeLocalDatabaseUrl(parseConsulValue(raw));
}

function runPrisma(
  serviceName: string,
  mode: MigrationMode,
  databaseUrl: string,
) {
  const serviceDir = path.resolve(process.cwd(), 'apps', serviceName);
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const prismaArgs =
    mode === 'dev'
      ? ['prisma', 'migrate', 'dev', '--schema', './prisma/schema.prisma']
      : ['prisma', 'migrate', 'deploy', '--schema', './prisma/schema.prisma'];

  console.log(`\n[db:${mode}] ${serviceName}`);
  console.log(`[db:${mode}] ${databaseUrl.replace(/:\/\/.*@/, '://***@')}`);

  const result = spawnSync(npxCommand, prismaArgs, {
    cwd: serviceDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      CHECKPOINT_DISABLE: '1',
      DATABASE_URL: databaseUrl,
      PRISMA_HIDE_UPDATE_MESSAGE: 'true',
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${serviceName} migration failed with exit code ${result.status}`,
    );
  }
}

async function main() {
  const modeArg = process.argv[2] ?? 'deploy';
  const mode: MigrationMode = modeArg === 'dev' ? 'dev' : 'deploy';
  const environment =
    process.argv[3] ||
    process.env.NODE_ENV ||
    resolveDefaultEnvironment(CONSUL_URL);

  console.log(`[db:${mode}] Consul URL : ${CONSUL_URL}`);
  console.log(`[db:${mode}] Environment: ${environment}`);

  for (const serviceName of SERVICES) {
    const databaseUrl = await fetchDatabaseUrl(serviceName, environment);
    runPrisma(serviceName, mode, databaseUrl);
  }

  console.log(`\n[db:${mode}] All Prisma migrations completed.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[db] ${message}`);
  process.exit(1);
});
