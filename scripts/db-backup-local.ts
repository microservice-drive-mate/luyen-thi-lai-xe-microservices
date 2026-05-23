import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type BackupTarget = {
  container: string;
  database: string;
  user: string;
};

const backupTargets: BackupTarget[] = [
  { container: 'db-identity', database: 'identity_db', user: 'user' },
  { container: 'db-user', database: 'user_db', user: 'user' },
  { container: 'db-course', database: 'course_db', user: 'user' },
  { container: 'db-keycloak', database: 'keycloak_db', user: 'keycloak' },
];

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function main(): void {
  const backupRoot = join(process.cwd(), 'backups', 'local', timestamp());
  mkdirSync(backupRoot, { recursive: true });

  for (const target of backupTargets) {
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
        '--format=plain',
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
      throw new Error(
        `Backup failed for ${target.database}: ${message || 'unknown error'}`,
      );
    }

    const filePath = join(backupRoot, `${target.database}.sql`);
    writeFileSync(filePath, result.stdout);
    console.log(`[backup] Wrote ${filePath}`);
  }

  console.log(`[backup] Completed local backups in ${backupRoot}`);
}

main();
