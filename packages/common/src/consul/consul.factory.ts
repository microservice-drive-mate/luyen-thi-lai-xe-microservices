import { Logger } from '@nestjs/common';
import { ConfigFactory } from '@nestjs/config';
import { ConsulConfigService } from './consul-config.service';
import Joi from 'joi';

type ConfigRecord = Record<string, unknown>;

// biome-ignore lint/complexity/noStaticOnlyClass: factory pattern kept as class for NestJS compatibility
export class ConsulConfigFactory {
  private static readonly logger = new Logger(ConsulConfigFactory.name);

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
        const envConfig = ConsulConfigFactory.loadFromEnv(env);
        config = ConsulConfigFactory.mergeConfig(consulConfig, envConfig);
        ConsulConfigFactory.logger.log('Configuration loaded from Consul');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ConsulConfigFactory.logger.warn(
          `Failed to load from Consul: ${message}, falling back to .env`,
        );
        config = ConsulConfigFactory.loadFromEnv(env);
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

  private static loadFromEnv(env: NodeJS.ProcessEnv): ConfigRecord {
    const consulUrl = env.CONSUL_URL || 'http://localhost:8500';

    // Only include a value when the env var is explicitly set.
    // Returning undefined lets mergeConfig keep the Consul value instead of
    // overwriting it with a hard-coded default.
    return {
      nodeEnv:
        env.NODE_ENV || ConsulConfigFactory.resolveDefaultNodeEnv(consulUrl),
      port: env.PORT !== undefined ? parseInt(env.PORT, 10) : undefined,
      logging:
        env.LOG_LEVEL !== undefined || env.LOG_FORMAT !== undefined
          ? {
              level: env.LOG_LEVEL,
              format: env.LOG_FORMAT,
            }
          : undefined,
      database: env.DATABASE_URL
        ? {
            url: env.DATABASE_URL,
            poolSize: env.DATABASE_POOL_SIZE
              ? parseInt(env.DATABASE_POOL_SIZE, 10)
              : undefined,
            connectionTimeout: env.DATABASE_CONNECTION_TIMEOUT
              ? parseInt(env.DATABASE_CONNECTION_TIMEOUT, 10)
              : undefined,
          }
        : undefined,
      rabbitmq: env.RABBITMQ_URL
        ? {
            url: env.RABBITMQ_URL,
            username: env.RABBITMQ_USERNAME,
            password: env.RABBITMQ_PASSWORD,
            vhost: env.RABBITMQ_VHOST,
            connectionTimeout: env.RABBITMQ_CONNECTION_TIMEOUT
              ? parseInt(env.RABBITMQ_CONNECTION_TIMEOUT, 10)
              : undefined,
            heartbeat: env.RABBITMQ_HEARTBEAT
              ? parseInt(env.RABBITMQ_HEARTBEAT, 10)
              : undefined,
          }
        : undefined,
    };
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
