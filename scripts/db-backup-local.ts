import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import type { Dirent, Stats } from 'node:fs';
import { basename, join } from 'node:path';

type BackupTarget = {
  serviceName: string;
  container: string;
  database: string;
  user: string;
};

const backupTargets: BackupTarget[] = [
  {
    serviceName: 'identity-service',
    container: 'db-identity',
    database: 'identity_db',
    user: 'user',
  },
  {
    serviceName: 'user-service',
    container: 'db-user',
    database: 'user_db',
    user: 'user',
  },
  {
    serviceName: 'exam-service',
    container: 'db-exam',
    database: 'exam_db',
    user: 'user',
  },
  {
    serviceName: 'course-service',
    container: 'db-course',
    database: 'course_db',
    user: 'user',
  },
  {
    serviceName: 'question-service',
    container: 'db-question',
    database: 'question_db',
    user: 'user',
  },
  {
    serviceName: 'notification-service',
    container: 'db-notification',
    database: 'notification_db',
    user: 'user',
  },
  {
    serviceName: 'analytics-service',
    container: 'db-analytics',
    database: 'analytics_db',
    user: 'user',
  },
  {
    serviceName: 'simulation-service',
    container: 'db-simulation',
    database: 'simulation_db',
    user: 'user',
  },
  {
    serviceName: 'media-service',
    container: 'db-media',
    database: 'media_db',
    user: 'user',
  },
  {
    serviceName: 'audit-service',
    container: 'db-audit',
    database: 'audit_db',
    user: 'user',
  },
  {
    serviceName: 'keycloak',
    container: 'db-keycloak',
    database: 'keycloak_db',
    user: 'keycloak',
  },
];

const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? '7');
const weeklyRetentionWeeks = Number(
  process.env.BACKUP_WEEKLY_RETENTION_WEEKS ?? '4',
);
const nodeEnv = process.env.NODE_ENV ?? 'development-local';

function timestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function main(): void {
  const backupRoot = join(process.cwd(), 'backups', 'postgres', nodeEnv);
  const backupDir = join(backupRoot, timestamp());
  const manifestPath = join(backupDir, 'manifest.csv');

  mkdirSync(backupDir, { recursive: true });
  writeFileSync(manifestPath, 'service,database,container,file\n');

  const failures: string[] = [];
  for (const target of backupTargets) {
    const fileName = `${target.serviceName}_${nodeEnv}_${basename(backupDir)}.dump`;
    const filePath = join(backupDir, fileName);
    const result = spawnSync(
      'docker',
      [
        'compose',
        '-f',
        'docker-compose.infra.yml',
        'exec',
        '-T',
        target.container,
        'pg_dump',
        '-U',
        target.user,
        '-d',
        target.database,
        '--format=custom',
        '--compress=6',
        '--no-owner',
        '--no-privileges',
      ],
      {
        cwd: process.cwd(),
        encoding: 'buffer',
      },
    );

    if (result.status !== 0) {
      const message = result.stderr.toString('utf8').trim();
      failures.push(
        `${target.serviceName}/${target.database}: ${message || 'unknown error'}`,
      );
      continue;
    }

    writeFileSync(filePath, result.stdout);
    writeFileSync(
      manifestPath,
      `${target.serviceName},${target.database},${target.container},${fileName}\n`,
      { flag: 'a' },
    );
    console.log(`[backup] Wrote ${filePath}`);
  }

  pruneOldBackups(backupRoot, retentionDays);

  if (failures.length > 0) {
    console.error('[backup] Failures detected:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  writeWeeklySnapshot(backupDir, backupRoot, weeklyRetentionWeeks);
  console.log(`[backup] Completed local backups in ${backupDir}`);
}

function writeWeeklySnapshot(
  backupDir: string,
  backupRoot: string,
  retentionWeeks: number,
): void {
  const now = new Date();
  if (now.getUTCDay() !== 0) {
    return;
  }

  const weekId = `${now.getUTCFullYear()}-W${String(getUtcWeek(now)).padStart(2, '0')}`;
  const weeklyRoot = join(backupRoot, 'weekly');
  const weeklyDir = join(weeklyRoot, weekId);

  rmSync(weeklyDir, { recursive: true, force: true });
  mkdirSync(weeklyDir, { recursive: true });

  for (const entry of readdirSync(backupDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const source = join(backupDir, entry.name);
    const target = join(weeklyDir, entry.name);
    writeFileSync(target, readFileSync(source));
  }

  pruneOldBackups(weeklyRoot, retentionWeeks * 7);
  console.log(`[backup] Wrote weekly snapshot ${weeklyDir}`);
}

function pruneOldBackups(backupRoot: string, days: number): void {
  if (!Number.isFinite(days) || days < 0 || !existsSync(backupRoot)) {
    return;
  }

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const entries = readdirSync(backupRoot, {
    withFileTypes: true,
  }) as Dirent[];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'weekly') {
      continue;
    }

    const fullPath = join(backupRoot, entry.name);
    const stats = statSync(fullPath) as Stats;
    if (stats.mtimeMs < cutoff) {
      rmSync(fullPath, { recursive: true, force: true });
      console.log(`[backup] Pruned old backup directory ${fullPath}`);
    }
  }
}

function getUtcWeek(date: Date): number {
  const copied = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = copied.getUTCDay() || 7;
  copied.setUTCDate(copied.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copied.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((copied.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
}

main();
