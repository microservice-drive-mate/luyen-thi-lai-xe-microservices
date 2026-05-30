/**
 * with-consul-env.ts
 *
 * Resolves DATABASE_URL for a given service from Consul KV, then spawns the
 * provided command with that URL injected into the environment.
 *
 * Priority: existing DATABASE_URL env var > Consul KV > error
 *
 * Usage:
 *   tsx scripts/with-consul-env.ts <service-name> -- <command> [args...]
 *
 * Example (from apps/identity-service):
 *   tsx ../../scripts/with-consul-env.ts identity-service -- prisma migrate dev --schema ./prisma/schema.prisma
 */

import axios from 'axios';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const CONSUL_URL = process.env.CONSUL_URL || 'http://localhost:8500';
const PLACEHOLDER_PATTERN = /\$\{([A-Z0-9_]+)(?::-(.*?))?\}/g;

function resolveNodeEnv(consulUrl: string): string {
  const normalized = consulUrl.toLowerCase();
  if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
    return 'development-local';
  }
  return 'development';
}

function parseConsulValue(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return String(parsed);
  } catch {
    return raw;
  }
}

function loadEnvFile(envFile: string): Record<string, string> {
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

function resolvePlaceholders(
  value: string,
  envValues: Record<string, string | undefined>,
): string {
  return value.replace(
    PLACEHOLDER_PATTERN,
    (_match, name: string, defaultValue: string | undefined) => {
      const envValue = envValues[name];
      if (envValue !== undefined && envValue !== '') {
        return envValue;
      }
      return defaultValue ?? '';
    },
  );
}

function resolveDatabaseUrlFromLocalSeed(
  serviceName: string,
  nodeEnv: string,
  envValues: Record<string, string | undefined>,
): string | undefined {
  const seedFile = path.join(__dirname, `../consul-seed-${nodeEnv}.json`);
  if (!fs.existsSync(seedFile)) {
    return undefined;
  }

  const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  const raw = seedData[nodeEnv]?.[serviceName]?.['database.url'];
  if (!raw) {
    return undefined;
  }

  return resolvePlaceholders(raw, envValues);
}

function buildShadowDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const databaseName = url.pathname.replace(/^\//, '');
  if (!databaseName) {
    return databaseUrl;
  }

  url.pathname = `/${databaseName}_shadow`;
  return url.toString();
}

function normalizeLocalhostDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
  }
  return url.toString();
}

async function fetchDatabaseUrl(serviceName: string): Promise<string | null> {
  const nodeEnv = process.env.NODE_ENV || resolveNodeEnv(CONSUL_URL);
  const key = `config/${nodeEnv}/${serviceName}/database.url`;

  console.log(`[consul-env] Consul URL : ${CONSUL_URL}`);
  console.log(`[consul-env] Environment: ${nodeEnv}`);
  console.log(`[consul-env] Fetching   : ${key}`);

  const response = await axios.get(`${CONSUL_URL}/v1/kv/${key}`);

  if (!response.data || response.data.length === 0) {
    return null;
  }

  const kvData = response.data[0] as { Value: string };
  const raw = Buffer.from(kvData.Value, 'base64').toString('utf-8');
  return parseConsulValue(raw);
}

async function main() {
  const args = process.argv.slice(2);

  const sepIndex = args.indexOf('--');
  const serviceName = args[0];
  const command = sepIndex !== -1 ? args.slice(sepIndex + 1) : args.slice(1);

  if (!serviceName || command.length === 0) {
    console.error(
      'Usage: tsx scripts/with-consul-env.ts <service-name> -- <command> [args...]',
    );
    process.exit(1);
  }

  const repoRoot = path.join(__dirname, '..');
  const rootEnv = loadEnvFile(path.join(repoRoot, '.env'));
  const serviceEnv = loadEnvFile(
    path.join(repoRoot, 'apps', serviceName, '.env'),
  );
  const mergedEnv = { ...rootEnv, ...serviceEnv, ...process.env };
  const nodeEnv = process.env.NODE_ENV || resolveNodeEnv(CONSUL_URL);

  let databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    console.log(
      '[consul-env] Using DATABASE_URL from environment (skipping Consul)',
    );
  } else {
    try {
      databaseUrl = (await fetchDatabaseUrl(serviceName)) ?? undefined;
      if (!databaseUrl) {
        console.error(
          `[consul-env] Key not found in Consul for service "${serviceName}"`,
        );
      }
      if (databaseUrl) {
        console.log('[consul-env] DATABASE_URL resolved from Consul');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[consul-env] Failed to fetch DATABASE_URL from Consul: ${message}`,
      );
    }

    if (!databaseUrl) {
      databaseUrl = resolveDatabaseUrlFromLocalSeed(
        serviceName,
        nodeEnv,
        mergedEnv,
      );
      if (databaseUrl) {
        console.log('[consul-env] DATABASE_URL resolved from local seed/env');
      }
    }

    if (!databaseUrl) {
      databaseUrl = serviceEnv.DATABASE_URL;
      if (databaseUrl) {
        console.log('[consul-env] DATABASE_URL resolved from service .env');
      }
    }

    if (!databaseUrl) {
      console.error(
        '[consul-env] DATABASE_URL not found in env, Consul, local seed, or service .env',
      );
      process.exit(1);
    }
  }

  databaseUrl = normalizeLocalhostDatabaseUrl(databaseUrl);

  console.log(`[consul-env] Running: ${command.join(' ')}\n`);

  const shadowDatabaseUrl =
    process.env.SHADOW_DATABASE_URL ?? buildShadowDatabaseUrl(databaseUrl);

  const result = spawnSync(command[0], command.slice(1), {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      SHADOW_DATABASE_URL: shadowDatabaseUrl,
    },
  });

  process.exit(result.status ?? 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[consul-env] Unexpected error:', message);
  process.exit(1);
});
