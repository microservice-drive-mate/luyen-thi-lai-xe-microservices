import { Logger } from '@nestjs/common';
import { ConfigFactory } from '@nestjs/config';
import { ConsulConfigService } from './consul-config.service';
import Joi from 'joi';

type ConfigRecord = Record<string, unknown>;

// biome-ignore lint/complexity/noStaticOnlyClass: factory pattern kept as class for NestJS compatibility
export class ConsulConfigFactory {
  private static readonly logger = new Logger(ConsulConfigFactory.name);

  static envFilePaths(): string[] {
    return ['.env', '../.env', '../../.env', '../../../.env'];
  }

  /**
   * Create async config factory
   * Priority: Environment Variables > Consul KV > .env File > Defaults
   */
  static create(
    joiSchema?: Joi.ObjectSchema,
    serviceName?: string,
  ): ConfigFactory {
    return async () => {
      const env = process.env;
      const consulUrl = env.CONSUL_URL || 'http://localhost:8500';
      const nodeEnv =
        env.NODE_ENV || ConsulConfigFactory.resolveDefaultNodeEnv(consulUrl);

      ConsulConfigFactory.logger.log(
        `Loading configuration from environment: ${nodeEnv}`,
      );
      ConsulConfigFactory.logger.log(`Consul URL: ${consulUrl}`);

      let config: ConfigRecord = {};

      try {
        const consulConfig = await ConsulConfigFactory.loadFromConsul(
          consulUrl,
          nodeEnv,
          serviceName,
        );
        const envConfig = ConsulConfigFactory.loadFromEnv(env, serviceName);
        config = ConsulConfigFactory.mergeConfig(consulConfig, envConfig);
        ConsulConfigFactory.logger.log('Configuration loaded from Consul');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ConsulConfigFactory.logger.warn(
          `Failed to load from Consul: ${message}, falling back to .env`,
        );
        config = ConsulConfigFactory.loadFromEnv(env, serviceName);
        ConsulConfigFactory.logger.log('Configuration loaded from .env file');
      }

      if (joiSchema) {
        const { error, value } = joiSchema.validate(config, {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          ConsulConfigFactory.logger.error(
            `Configuration validation failed: ${error.message}`,
          );
          throw new Error(`Configuration validation error: ${error.message}`);
        }

        return value;
      }

      return config;
    };
  }

  private static async loadFromConsul(
    consulUrl: string,
    nodeEnv: string,
    serviceName?: string,
  ): Promise<ConfigRecord> {
    const consul = new ConsulConfigService(consulUrl);
    const isHealthy = await consul.isHealthy();

    if (!isHealthy) {
      throw new Error('Consul server is not healthy');
    }

    const config: ConfigRecord = {}; // Helper xử lý triệt để chuỗi JSON và tự động ép kiểu sâu (deep parse)

    const parseValue = (val: unknown): unknown => {
      if (typeof val === 'string') {
        try {
          // Thử parse nếu giá trị là một chuỗi JSON hợp lệ
          const parsed = JSON.parse(val); // Nếu parse ra được object (nested JSON), gọi đệ quy để quét các node con
          if (typeof parsed === 'object' && parsed !== null) {
            return parseValue(parsed);
          }
          return parsed; // Trả về số/boolean nếu JSON.parse chuyển thành công
        } catch (_e) {
          // Rớt xuống đây nếu là chuỗi bình thường (không phải định dạng JSON)
          if (!Number.isNaN(Number(val)) && val.trim() !== '') {
            return Number(val);
          }
          if (val.toLowerCase() === 'true') return true;
          if (val.toLowerCase() === 'false') return false;
          return val;
        }
      }

      if (Array.isArray(val)) {
        return val.map((item) => parseValue(item));
      }

      if (typeof val === 'object' && val !== null) {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val)) {
          result[k] = parseValue(v);
        }
        return result;
      }

      return val;
    }; // Gom logic xử lý config lại để không bị lặp code

    const processConfig = (
      consulConfig: Record<string, unknown>,
      prefix: string,
    ) => {
      Object.entries(consulConfig).forEach(([key, value]) => {
        const configKey = key.replace(prefix, '').replace(/\//g, '.');
        const parsedValue = parseValue(value); // Nếu user lưu nguyên 1 cụm JSON tại key gốc (làm cho configKey bị rỗng "")

        if (
          configKey === '' &&
          typeof parsedValue === 'object' &&
          parsedValue !== null &&
          !Array.isArray(parsedValue)
        ) {
          // Phải bung các key bên trong object đó ra và nạp thẳng vào root config
          Object.entries(parsedValue).forEach(([k, v]) => {
            ConsulConfigFactory.setNestedValue(config, k, v);
          });
        } else {
          ConsulConfigFactory.setNestedValue(config, configKey, parsedValue);
        }
      });
    };

    const sharedPrefix = `config/${nodeEnv}/shared/`;
    const sharedConfig = await consul.getByPrefix(sharedPrefix);
    processConfig(sharedConfig, sharedPrefix);

    if (serviceName) {
      const servicePrefix = `config/${nodeEnv}/${serviceName}/`;
      const serviceConfig = await consul.getByPrefix(servicePrefix);
      processConfig(serviceConfig, servicePrefix);
    }

    return config;
  }

  private static loadFromEnv(
    env: NodeJS.ProcessEnv,
    serviceName?: string,
  ): ConfigRecord {
    const consulUrl = env.CONSUL_URL || 'http://localhost:8500';
    const nodeEnv =
      env.NODE_ENV || ConsulConfigFactory.resolveDefaultNodeEnv(consulUrl);
    const hasStorageCredentials = Boolean(
      env.STORAGE_ACCOUNT_NAME &&
        (env.SECRET_STORAGE_ACCOUNT_KEY || env.STORAGE_ACCOUNT_KEY),
    );
    const rabbitmqConfig = ConsulConfigFactory.buildRabbitMqConfig(
      env,
      nodeEnv,
    );
    const databaseUrl = ConsulConfigFactory.normalizeDevelopmentLocalUrl(
      ConsulConfigFactory.resolveServiceSecret(env, serviceName, 'DB_URL') ??
        env.DATABASE_URL,
      nodeEnv,
      serviceName,
    );

    // Only include a value when the env var is explicitly set.
    // Returning undefined lets mergeConfig keep the Consul value instead of
    // overwriting it with a hard-coded default.
    return {
      nodeEnv: nodeEnv,
      port: env.PORT !== undefined ? parseInt(env.PORT, 10) : undefined,
      logging:
        env.LOG_LEVEL !== undefined || env.LOG_FORMAT !== undefined
          ? {
              level: env.LOG_LEVEL,
              format: env.LOG_FORMAT,
            }
          : undefined,
      database: databaseUrl
        ? {
            url: databaseUrl,
            poolSize: env.DATABASE_POOL_SIZE
              ? parseInt(env.DATABASE_POOL_SIZE, 10)
              : undefined,
            connectionTimeout: env.DATABASE_CONNECTION_TIMEOUT
              ? parseInt(env.DATABASE_CONNECTION_TIMEOUT, 10)
              : undefined,
          }
        : undefined,
      rabbitmq: rabbitmqConfig,
      keycloak:
        env.KEYCLOAK_AUTH_SERVER_URL ||
        env.KEYCLOAK_REALM ||
        env.KEYCLOAK_CLIENT_ID ||
        env.KEYCLOAK_CLIENT_SECRET
          ? {
              authServerUrl: env.KEYCLOAK_AUTH_SERVER_URL,
              realm: env.KEYCLOAK_REALM,
              clientId: env.KEYCLOAK_CLIENT_ID,
              clientSecret:
                env.SECRET_KEYCLOAK_CLIENT_SECRET ?? env.KEYCLOAK_CLIENT_SECRET,
              timeoutMs: env.KEYCLOAK_TIMEOUT_MS
                ? parseInt(env.KEYCLOAK_TIMEOUT_MS, 10)
                : undefined,
            }
          : undefined,
      redis: env.REDIS_URL
        ? {
            url: ConsulConfigFactory.normalizeDevelopmentLocalUrl(
              env.REDIS_URL,
              nodeEnv,
            ),
          }
        : undefined,
      notification: env.NOTIFICATION_WARNING_RETRY_INTERVAL_MS
        ? {
            warningRetryIntervalMs: parseInt(
              env.NOTIFICATION_WARNING_RETRY_INTERVAL_MS,
              10,
            ),
          }
        : undefined,
      storage: hasStorageCredentials
        ? {
            accountName: env.STORAGE_ACCOUNT_NAME,
            accountKey:
              env.SECRET_STORAGE_ACCOUNT_KEY ?? env.STORAGE_ACCOUNT_KEY,
            containerName: env.STORAGE_CONTAINER_NAME,
            presignedUrlExpiry: env.STORAGE_PRESIGNED_URL_EXPIRY
              ? parseInt(env.STORAGE_PRESIGNED_URL_EXPIRY, 10)
              : undefined,
          }
        : undefined,
      swagger: env.SWAGGER_SERVICES
        ? {
            services: env.SWAGGER_SERVICES,
          }
        : undefined,
      smtp:
        env.KEYCLOAK_SMTP_HOST ||
        env.KEYCLOAK_SMTP_PORT ||
        env.KEYCLOAK_SMTP_USER ||
        env.KEYCLOAK_SMTP_PASSWORD ||
        env.KEYCLOAK_SMTP_FROM
          ? {
              host: env.KEYCLOAK_SMTP_HOST,
              port: env.KEYCLOAK_SMTP_PORT
                ? parseInt(env.KEYCLOAK_SMTP_PORT, 10)
                : undefined,
              user: env.KEYCLOAK_SMTP_USER,
              pass: env.KEYCLOAK_SMTP_PASSWORD,
              from: env.KEYCLOAK_SMTP_FROM,
              secure: parseBoolean(env.KEYCLOAK_SMTP_SSL),
              starttls: parseBoolean(env.KEYCLOAK_SMTP_STARTTLS),
            }
          : undefined,
      push: env.FCM_CREDENTIALS
        ? {
            fcmCredentials: env.FCM_CREDENTIALS,
          }
        : undefined,
      retry:
        env.NOTIFICATION_RETRY_MAX_ATTEMPTS ||
        env.NOTIFICATION_RETRY_INTERVAL_MS
          ? {
              maxAttempts: env.NOTIFICATION_RETRY_MAX_ATTEMPTS
                ? parseInt(env.NOTIFICATION_RETRY_MAX_ATTEMPTS, 10)
                : undefined,
              intervalMs: env.NOTIFICATION_RETRY_INTERVAL_MS
                ? parseInt(env.NOTIFICATION_RETRY_INTERVAL_MS, 10)
                : undefined,
            }
          : undefined,
      services:
        env.QUESTION_SERVICE_URL ||
        env.USER_SERVICE_URL ||
        env.QUESTION_SERVICE_TIMEOUT_MS ||
        env.USER_SERVICE_TIMEOUT_MS
          ? {
              question:
                env.QUESTION_SERVICE_URL || env.QUESTION_SERVICE_TIMEOUT_MS
                  ? {
                      baseUrl: env.QUESTION_SERVICE_URL,
                      timeoutMs: env.QUESTION_SERVICE_TIMEOUT_MS
                        ? parseInt(env.QUESTION_SERVICE_TIMEOUT_MS, 10)
                        : undefined,
                    }
                  : undefined,
              user:
                env.USER_SERVICE_URL || env.USER_SERVICE_TIMEOUT_MS
                  ? {
                      baseUrl: env.USER_SERVICE_URL,
                      timeoutMs: env.USER_SERVICE_TIMEOUT_MS
                        ? parseInt(env.USER_SERVICE_TIMEOUT_MS, 10)
                        : undefined,
                    }
                  : undefined,
            }
          : undefined,
    };
  }

  private static buildRabbitMqConfig(
    env: NodeJS.ProcessEnv,
    nodeEnv: string,
  ): ConfigRecord | undefined {
    const username =
      env.SECRET_RABBITMQ_USERNAME ??
      env.RABBITMQ_USERNAME ??
      env.RABBITMQ_DEFAULT_USER;
    const password =
      env.SECRET_RABBITMQ_PASSWORD ??
      env.RABBITMQ_PASSWORD ??
      env.RABBITMQ_DEFAULT_PASS;
    const rabbitMqUrl = env.SECRET_RABBITMQ_URL ?? env.RABBITMQ_URL;
    const hasRabbitMqConfig = Boolean(
      rabbitMqUrl ||
        username ||
        password ||
        env.RABBITMQ_HOST ||
        env.RABBITMQ_PORT ||
        env.RABBITMQ_CONNECTION_TIMEOUT ||
        env.RABBITMQ_HEARTBEAT,
    );

    if (!hasRabbitMqConfig) {
      return undefined;
    }

    const host =
      env.RABBITMQ_HOST ??
      (nodeEnv === 'development-local' ? 'localhost' : 'rabbitmq');
    const port = env.RABBITMQ_PORT ?? '5672';
    const scheme = env.RABBITMQ_SCHEME ?? 'amqp';
    const credentials =
      username && password
        ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
        : '';

    return {
      url:
        ConsulConfigFactory.normalizeDevelopmentLocalUrl(
          rabbitMqUrl,
          nodeEnv,
        ) ?? `${scheme}://${credentials}${host}:${port}`,
      username,
      password,
      vhost: env.RABBITMQ_VHOST,
      connectionTimeout: env.RABBITMQ_CONNECTION_TIMEOUT
        ? parseInt(env.RABBITMQ_CONNECTION_TIMEOUT, 10)
        : undefined,
      heartbeat: env.RABBITMQ_HEARTBEAT
        ? parseInt(env.RABBITMQ_HEARTBEAT, 10)
        : undefined,
    };
  }

  private static normalizeDevelopmentLocalUrl(
    value: string | undefined,
    nodeEnv: string,
    serviceName?: string,
  ): string | undefined {
    if (!value || nodeEnv !== 'development-local') {
      return value;
    }

    try {
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase();

      if (hostname === 'rabbitmq') {
        url.hostname = 'localhost';
        return url.toString();
      }

      if (hostname === 'redis') {
        url.hostname = 'localhost';
        return url.toString();
      }

      const port = ConsulConfigFactory.resolveDevelopmentLocalDatabasePort(
        hostname,
        serviceName,
      );
      if (port) {
        url.hostname = 'localhost';
        url.port = port;
        return url.toString();
      }
    } catch {
      return value;
    }

    return value;
  }

  private static resolveDevelopmentLocalDatabasePort(
    hostname: string,
    serviceName?: string,
  ): string | undefined {
    const serviceKey =
      serviceName?.replace(/-service$/, '') ?? hostname.replace(/^db-/, '');
    const ports: Record<string, string> = {
      identity: '5432',
      user: '5433',
      exam: '5434',
      course: '5435',
      question: '5436',
      notification: '5437',
      analytics: '5438',
      simulation: '5439',
      media: '5440',
      audit: '5441',
    };

    if (hostname === `db-${serviceKey}` || hostname.startsWith('db-')) {
      return ports[serviceKey];
    }

    return undefined;
  }

  private static resolveServiceSecret(
    env: NodeJS.ProcessEnv,
    serviceName: string | undefined,
    suffix: string,
  ): string | undefined {
    if (!serviceName) {
      return undefined;
    }

    const serviceKey = serviceName
      .replace(/-service$/, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .toUpperCase();
    return env[`SECRET_${serviceKey}_${suffix}`];
  }

  private static setNestedValue(
    target: ConfigRecord,
    path: string,
    value: unknown,
  ): void {
    const segments = path.split('.');
    let current = target;

    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      if (
        typeof current[segment] !== 'object' ||
        current[segment] === null ||
        Array.isArray(current[segment])
      ) {
        current[segment] = {};
      }
      current = current[segment] as ConfigRecord;
    }

    current[segments[segments.length - 1]] = value;
  }

  private static mergeConfig(
    base: ConfigRecord,
    override: ConfigRecord,
  ): ConfigRecord {
    const result: ConfigRecord = { ...base };

    Object.entries(override).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }

      const baseValue = result[key];
      if (
        typeof baseValue === 'object' &&
        baseValue !== null &&
        !Array.isArray(baseValue) &&
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        result[key] = ConsulConfigFactory.mergeConfig(
          baseValue as ConfigRecord,
          value as ConfigRecord,
        );
        return;
      }

      result[key] = value;
    });

    return result;
  }

  private static resolveDefaultNodeEnv(consulUrl: string): string {
    const normalizedUrl = consulUrl.toLowerCase();
    if (
      normalizedUrl.includes('localhost') ||
      normalizedUrl.includes('127.0.0.1')
    ) {
      return 'development-local';
    }

    return 'development';
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
}
