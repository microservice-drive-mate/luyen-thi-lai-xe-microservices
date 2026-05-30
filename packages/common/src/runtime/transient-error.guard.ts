import { Logger } from '@nestjs/common';

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EHOSTUNREACH',
]);

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isTransientNetworkError(error: unknown): boolean {
  const code = errorCode(error);
  if (code && TRANSIENT_NETWORK_CODES.has(code)) {
    return true;
  }

  const message = errorMessage(error).toLowerCase();
  return (
    message.includes('read econnreset') ||
    message.includes('socket hang up') ||
    message.includes('connection closed')
  );
}

export function installLocalDevTransientErrorGuard(
  serviceName = process.env.SERVICE_NAME ||
    process.env.npm_package_name ||
    'unknown-service',
): void {
  if (process.env.NODE_ENV !== 'development-local') {
    return;
  }

  const processWithFlag = process as NodeJS.Process & {
    __localDevTransientErrorGuardInstalled?: boolean;
  };
  if (processWithFlag.__localDevTransientErrorGuardInstalled) {
    return;
  }
  processWithFlag.__localDevTransientErrorGuardInstalled = true;

  const logger = new Logger('LocalDevTransientErrorGuard');
  process.on('uncaughtException', (error) => {
    if (!isTransientNetworkError(error)) {
      logger.error(
        `[${serviceName}] fatal uncaught exception: ${errorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      process.exitCode = 1;
      process.exit(1);
      return;
    }

    logger.warn(
      `[${serviceName}] ignored transient infrastructure error in local dev: ${errorMessage(error)}`,
    );
  });

  process.on('unhandledRejection', (reason) => {
    if (!isTransientNetworkError(reason)) {
      logger.error(
        `[${serviceName}] fatal unhandled rejection: ${errorMessage(reason)}`,
        reason instanceof Error ? reason.stack : undefined,
      );
      process.exitCode = 1;
      process.exit(1);
      return;
    }

    logger.warn(
      `[${serviceName}] ignored transient infrastructure rejection in local dev: ${errorMessage(reason)}`,
    );
  });
}

export async function runBootstrapWithRetries(
  serviceName: string,
  bootstrap: () => Promise<void>,
  options: {
    retryDelayMs?: number;
    maxAttempts?: number;
  } = {},
): Promise<void> {
  const logger = new Logger('Bootstrap');
  const retryDelayMs = options.retryDelayMs ?? 3_000;
  const maxAttempts =
    options.maxAttempts ??
    (process.env.NODE_ENV === 'development-local'
      ? Number.POSITIVE_INFINITY
      : 1);
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      await bootstrap();
      return;
    } catch (error) {
      if (!isTransientNetworkError(error) || attempt >= maxAttempts) {
        logger.error(
          `[${serviceName}] bootstrap failed: ${errorMessage(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
        process.exitCode = 1;
        return;
      }

      logger.warn(
        `[${serviceName}] bootstrap transient infrastructure error, retrying in ${retryDelayMs}ms: ${errorMessage(error)}`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}
