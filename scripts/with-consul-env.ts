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

import axios from "axios";
import { spawnSync } from "node:child_process";

const CONSUL_URL = process.env.CONSUL_URL || "http://localhost:8500";

function resolveNodeEnv(consulUrl: string): string {
  const normalized = consulUrl.toLowerCase();
  if (normalized.includes("localhost") || normalized.includes("127.0.0.1")) {
    return "development-local";
  }
  return "development";
}

function parseConsulValue(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return String(parsed);
  } catch {
    return raw;
  }
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
  const raw = Buffer.from(kvData.Value, "base64").toString("utf-8");
  return parseConsulValue(raw);
}

async function main() {
  const args = process.argv.slice(2);

  const sepIndex = args.indexOf("--");
  const serviceName = args[0];
  const command = sepIndex !== -1 ? args.slice(sepIndex + 1) : args.slice(1);

  if (!serviceName || command.length === 0) {
    console.error(
      "Usage: tsx scripts/with-consul-env.ts <service-name> -- <command> [args...]",
    );
    process.exit(1);
  }

  let databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    console.log("[consul-env] Using DATABASE_URL from environment (skipping Consul)");
  } else {
    try {
      databaseUrl = (await fetchDatabaseUrl(serviceName)) ?? undefined;
      if (!databaseUrl) {
        console.error(`[consul-env] Key not found in Consul for service "${serviceName}"`);
        process.exit(1);
      }
      console.log("[consul-env] DATABASE_URL resolved from Consul");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[consul-env] Failed to fetch DATABASE_URL from Consul: ${message}`);
      console.error("[consul-env] Make sure Consul is running or set DATABASE_URL directly");
      process.exit(1);
    }
  }

  console.log(`[consul-env] Running: ${command.join(" ")}\n`);

  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  process.exit(result.status ?? 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[consul-env] Unexpected error:", message);
  process.exit(1);
});
