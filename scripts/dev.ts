import { spawnSync } from 'node:child_process';

const turboCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const result = spawnSync(
  turboCommand,
  ['turbo', 'run', 'start:dev', '--filter=./apps/*', '--concurrency=15'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      CONSUL_URL: process.env.CONSUL_URL || 'http://127.0.0.1:8500',
      LOGSTASH_HOST: process.env.LOGSTASH_HOST ?? '127.0.0.1',
      LOGSTASH_PORT: process.env.LOGSTASH_PORT ?? '5044',
      NODE_ENV: 'development-local',
    },
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
