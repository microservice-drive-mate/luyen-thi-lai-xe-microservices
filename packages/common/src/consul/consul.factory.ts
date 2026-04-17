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
      const nodeEnv = env.NODE_ENV || 'development';
      const consulUrl = env.CONSUL_URL || 'http://localhost:8500';

      this.logger.log(`Loading configuration from environment: ${nodeEnv}`);
      this.logger.log(`Consul URL: ${consulUrl}`);

      let config: Record<string, any> = {};

      // Try to load from Consul first
      try {
        config = await this.loadFromConsul(
          consulUrl,
          nodeEnv,
          serviceName,
        );
        this.logger.log('✓ Configuration loaded from Consul');
      } catch (error: any) {
        this.logger.warn(
          `Failed to load from Consul: ${error.message}, falling back to .env`,
        );

        // Fallback to .env file / environment variables
        config = this.loadFromEnv(env);
        this.logger.log(
          '✓ Configuration loaded from .env file (Consul unavailable)',
        );
      }

      // Validate configuration if schema provided
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

  /**
   * Load configuration from Consul KV Store
   */
  private static async loadFromConsul(
    consulUrl: string,
    nodeEnv: string,
    serviceName?: string,
  ): Promise<Record<string, any>> {
    const consul = new ConsulConfigService(consulUrl);

    // Check if Consul is healthy
    const isHealthy = await consul.isHealthy();
    if (!isHealthy) {
      throw new Error('Consul server is not healthy');
    }

    const config: Record<string, any> = {};

    // Load shared configuration
    const sharedPrefix = `config/${nodeEnv}/shared/`;
    const sharedConfig = await consul.getByPrefix(sharedPrefix);
    Object.entries(sharedConfig).forEach(([key, value]) => {
      const configKey = key.replace(sharedPrefix, '').replace(/\//g, '.');
      config[configKey] = value;
    });

    // Load service-specific configuration
    if (serviceName) {
      const servicePrefix = `config/${nodeEnv}/${serviceName}/`;
      const serviceConfig = await consul.getByPrefix(servicePrefix);
      Object.entries(serviceConfig).forEach(([key, value]) => {
        const configKey = key.replace(servicePrefix, '').replace(/\//g, '.');
        config[configKey] = value;
      });
    }

    return config;
  }

  /**
   * Load configuration from environment variables and defaults
   */
  private static loadFromEnv(env: NodeJS.ProcessEnv): Record<string, any> {
    return {
      nodeEnv: env.NODE_ENV || 'development',
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
}
