import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

type RestoreTarget = {
  serviceName: string;
  database: string;
};

const backupFile = process.env.RESTORE_TEST_BACKUP_FILE
  ? resolve(process.env.RESTORE_TEST_BACKUP_FILE)
  : findLatestDump();
const postgresImage =
  process.env.RESTORE_TEST_POSTGRES_IMAGE ?? 'postgres:15-alpine';
const containerName = `restore-test-${Date.now()}`;
const password = 'restore_test_password';
const database = 'restore_test_db';

function main(): void {
  if (!backupFile || !existsSync(backupFile)) {
    throw new Error(
      'No backup file found. Set RESTORE_TEST_BACKUP_FILE or run a backup first.',
    );
  }

  const target = inferTarget(backupFile);
  console.log(`[restore-test] Backup file: ${backupFile}`);
  console.log(
    `[restore-test] Target metadata: service=${target.serviceName}, sourceDatabase=${target.database}`,
  );

  run('docker', [
    'run',
    '--name',
    containerName,
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    '-e',
    `POSTGRES_DB=${database}`,
    '-d',
    postgresImage,
  ]);

  try {
    waitForPostgres();
    run('docker', ['cp', backupFile, `${containerName}:/tmp/backup.dump`]);
    run('docker', [
      'exec',
      '-e',
      `PGPASSWORD=${password}`,
      containerName,
      'pg_restore',
      '--list',
      '/tmp/backup.dump',
    ]);
    run('docker', [
      'exec',
      '-e',
      `PGPASSWORD=${password}`,
      containerName,
      'pg_restore',
      '-U',
      'postgres',
      '-d',
      database,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '/tmp/backup.dump',
    ]);
    console.log('[restore-test] Restore completed successfully.');
  } finally {
    spawnSync('docker', ['rm', '-f', containerName], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'ignore',
    });
  }
}

function waitForPostgres(): void {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const result = spawnSync(
      'docker',
      [
        'exec',
        '-e',
        `PGPASSWORD=${password}`,
        containerName,
        'pg_isready',
        '-U',
        'postgres',
        '-d',
        database,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    if (result.status === 0) {
      return;
    }

    sleep(1000);
  }

  throw new Error('Temporary PostgreSQL container did not become ready.');
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function findLatestDump(): string | undefined {
  const root = join(process.cwd(), 'backups', 'postgres');
  if (!existsSync(root)) {
    return undefined;
  }

  const dumps = walk(root).filter((file) => file.endsWith('.dump'));
  dumps.sort();
  return dumps[dumps.length - 1];
}

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function inferTarget(filePath: string): RestoreTarget {
  const fileName = basename(filePath);
  const serviceName = fileName.split('_')[0] ?? 'unknown';
  const database = serviceNameToDatabase(serviceName);
  return { serviceName, database };
}

function serviceNameToDatabase(serviceName: string): string {
  const mapping: Record<string, string> = {
    'identity-service': 'identity_db',
    'user-service': 'user_db',
    'exam-service': 'exam_db',
    'course-service': 'course_db',
    'question-service': 'question_db',
    'notification-service': 'notification_db',
    'analytics-service': 'analytics_db',
    'simulation-service': 'simulation_db',
    'media-service': 'media_db',
    'audit-service': 'audit_db',
    keycloak: 'keycloak_db',
  };

  return mapping[serviceName] ?? 'unknown';
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

main();
