import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { getCurrentCorrelationId } from '../http/correlation-context';

function resolveServiceName(): string {
  return (
    process.env.SERVICE_NAME ||
    process.env.npm_package_name ||
    'unknown-service'
  );
}

function parseStructuredMessage(message: unknown): Record<string, unknown> {
  if (typeof message !== 'string') {
    return {};
  }

  const trimmed = message.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function shouldEnableLogstash(): boolean {
  if (!process.env.LOGSTASH_HOST) {
    return false;
  }

  if (process.env.LOGSTASH_ENABLED === 'false') {
    return false;
  }

  if (
    (process.env.NODE_ENV || 'development-local') === 'development-local' &&
    process.env.LOGSTASH_ENABLED !== 'true'
  ) {
    return false;
  }

  return true;
}

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: () => {
        const serviceName = resolveServiceName();
        const environment = process.env.NODE_ENV || 'development-local';
        const enrichLog = winston.format((info) => {
          const structuredMessage = parseStructuredMessage(info.message);

          Object.assign(info, structuredMessage);
          info.serviceName = info.serviceName || serviceName;
          info.environment = info.environment || environment;
          info.logType = info.logType || 'application';
          info.correlationId = info.correlationId || getCurrentCorrelationId();

          if (structuredMessage.logType === 'access') {
            info.rawMessage = info.message;
            info.message =
              `${String(info.method ?? 'HTTP')} ${String(info.path ?? '')} ${String(info.statusCode ?? '')}`.trim();
          }

          return info;
        });
        const jsonFormat = winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.ms(),
          enrichLog(),
          winston.format.json(),
        );

        const transports: winston.transport[] = [
          new winston.transports.Console({
            format:
              process.env.LOG_CONSOLE_FORMAT === 'json'
                ? jsonFormat
                : winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.ms(),
                    winston.format.colorize(),
                    enrichLog(),
                    winston.format.printf(
                      ({
                        timestamp,
                        level,
                        message,
                        context,
                        serviceName: currentServiceName,
                        correlationId,
                        ms,
                      }) => {
                        const correlationSuffix = correlationId
                          ? ` correlationId=${String(correlationId)}`
                          : '';

                        return `[${timestamp as string}] ${level} [${String(currentServiceName)}] [${(context as string) || 'Application'}]: ${message as string}${correlationSuffix} ${ms as string}`;
                      },
                    ),
                  ),
          }),
        ];

        if (shouldEnableLogstash()) {
          const logstashTransport = new winston.transports.Http({
            host: process.env.LOGSTASH_HOST,
            port: process.env.LOGSTASH_PORT
              ? parseInt(process.env.LOGSTASH_PORT, 10)
              : 5044,
            path: '/',
            format: jsonFormat,
          });

          logstashTransport.on('error', (error: Error) => {
            if (process.env.LOGSTASH_DEBUG === 'true') {
              console.warn(
                `[logger] Logstash transport unavailable: ${error.message}`,
              );
            }
          });

          transports.push(logstashTransport);
        }

        return {
          transports,
        };
      },
    }),
  ],
  exports: [WinstonModule],
})
export class AppLoggerModule {}
