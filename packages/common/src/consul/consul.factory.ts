import { Logger } from '@nestjs/common';
import { ConfigFactory } from '@nestjs/config';
import { ConsulConfigService } from './consul-config.service';
import Joi from 'joi';

/**
 * Consul-based configuration factory for NestJS ConfigModule
 * Loads configuration from Consul KV Store with fallback to .env file
 */
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
      const nodeEnv = env.NODE_ENV || this.resolveDefaultNodeEnv(consulUrl);

      this.logger.log(`Loading configuration from environment: ${nodeEnv}`);
      this.logger.log(`Consul URL: ${consulUrl}`);

      let config: Record<string, any> = {};

      try {
        const consulConfig = await this.loadFromConsul(
          consulUrl,
          nodeEnv,
          serviceName,
        );
        const envConfig = this.loadFromEnv(env);
        config = this.mergeConfig(consulConfig, envConfig);
        this.logger.log('Configuration loaded from Consul');
      } catch (error: any) {
        this.logger.warn(
          `Failed to load from Consul: ${error.message}, falling back to .env`,
        );
        config = this.loadFromEnv(env);
        this.logger.log('Configuration loaded from .env file');
      }

      if (joiSchema) {
        const { error, value } = joiSchema.validate(config, {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          this.logger.error(
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
  ): Promise<Record<string, any>> {
    const consul = new ConsulConfigService(consulUrl);
    const isHealthy = await consul.isHealthy();

    if (!isHealthy) {
      throw new Error('Consul server is not healthy');
    }

    const config: Record<string, any> = {};

    const sharedPrefix = `config/${nodeEnv}/shared/`;
    const sharedConfig = await consul.getByPrefix(sharedPrefix);
    Object.entries(sharedConfig).forEach(([key, value]) => {
      const configKey = key.replace(sharedPrefix, '').replace(/\//g, '.');
      this.setNestedValue(config, configKey, value);
    });

    if (serviceName) {
      const servicePrefix = `config/${nodeEnv}/${serviceName}/`;
      const serviceConfig = await consul.getByPrefix(servicePrefix);
      Object.entries(serviceConfig).forEach(([key, value]) => {
        const configKey = key.replace(servicePrefix, '').replace(/\//g, '.');
        this.setNestedValue(config, configKey, value);
      });
    }

    return config;
  }

  private static loadFromEnv(env: NodeJS.ProcessEnv): Record<string, any> {
    const consulUrl = env.CONSUL_URL || 'http://localhost:8500';

    return {
      nodeEnv: env.NODE_ENV || this.resolveDefaultNodeEnv(consulUrl),
      port: parseInt(env.PORT || '3000', 10),
      logging: {
        level: env.LOG_LEVEL || 'info',
        format: env.LOG_FORMAT || 'text',
      },
      database: env.DATABASE_URL
        ? {
            url: env.DATABASE_URL,
            poolSize: parseInt(env.DATABASE_POOL_SIZE || '10', 10),
            connectionTimeout: parseInt(
              env.DATABASE_CONNECTION_TIMEOUT || '5000',
              10,
            ),
          }
        : undefined,
      rabbitmq: env.RABBITMQ_URL
        ? {
            url: env.RABBITMQ_URL,
            username: env.RABBITMQ_USERNAME || 'guest',
            password: env.RABBITMQ_PASSWORD || 'guest',
            vhost: env.RABBITMQ_VHOST || '/',
            connectionTimeout: parseInt(
              env.RABBITMQ_CONNECTION_TIMEOUT || '10000',
              10,
            ),
            heartbeat: parseInt(env.RABBITMQ_HEARTBEAT || '60', 10),
          }
        : undefined,
    };
  }

  private static setNestedValue(
    target: Record<string, any>,
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
      current = current[segment] as Record<string, any>;
    }

    current[segments[segments.length - 1]] = value;
  }

  private static mergeConfig(
    base: Record<string, any>,
    override: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = { ...base };

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
        result[key] = this.mergeConfig(
          baseValue as Record<string, any>,
          value as Record<string, any>,
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
