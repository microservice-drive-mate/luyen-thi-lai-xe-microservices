import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
}

interface SeedableService {
  packageName: string;
  serviceName: string;
  serviceDir: string;
}

const appsDir = path.resolve(process.cwd(), 'apps');

function readPackageJson(packageJsonPath: string): PackageJson {
  return JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJson;
}

function discoverSeedableServices(): SeedableService[] {
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const serviceDir = path.join(appsDir, entry.name);
      const packageJsonPath = path.join(serviceDir, 'package.json');

      if (!existsSync(packageJsonPath)) {
        return null;
      }

      const packageJson = readPackageJson(packageJsonPath);
      if (!packageJson.scripts?.['db:seed']) {
        return null;
      }

      return {
        packageName: packageJson.name ?? entry.name,
        serviceName: entry.name,
        serviceDir,
      };
    })
    .filter((service): service is SeedableService => service !== null)
    .sort((left, right) => left.serviceName.localeCompare(right.serviceName));
}

function resolveRequestedServices(
  seedableServices: SeedableService[],
): SeedableService[] {
  const requestedNames = process.argv.slice(2);

  if (requestedNames.length === 0) {
    return seedableServices;
  }

  const byName = new Map<string, SeedableService>();
  for (const service of seedableServices) {
    byName.set(service.serviceName, service);
    byName.set(service.packageName, service);
  }

  return requestedNames.map((requestedName) => {
    const service = byName.get(requestedName);
    if (!service) {
      throw new Error(
        `Service "${requestedName}" has no db:seed script or does not exist`,
      );
    }

    return service;
  });
}

function runSeed(service: SeedableService): void {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  console.log(`\n[db:seed] ${service.serviceName}`);

  const result = spawnSync(npmCommand, ['run', 'db:seed'], {
    cwd: service.serviceDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      CHECKPOINT_DISABLE: '1',
      PRISMA_HIDE_UPDATE_MESSAGE: 'true',
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${service.serviceName} seed failed with exit code ${result.status}`,
    );
  }
}

function main(): void {
  const seedableServices = discoverSeedableServices();
  const servicesToSeed = resolveRequestedServices(seedableServices);

  if (servicesToSeed.length === 0) {
    console.log('[db:seed] No services with db:seed script found.');
    return;
  }

  console.log(
    `[db:seed] Services: ${servicesToSeed
      .map((service) => service.serviceName)
      .join(', ')}`,
  );

  for (const service of servicesToSeed) {
    runSeed(service);
  }

  console.log('\n[db:seed] All seed scripts completed.');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[db:seed] ${message}`);
  process.exit(1);
}
