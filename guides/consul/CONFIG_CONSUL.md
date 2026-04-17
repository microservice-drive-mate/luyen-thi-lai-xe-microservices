# Consul Configuration Management Guide

This guide explains how the microservices project uses HashiCorp Consul for centralized configuration management.

## Overview

Consul serves as a centralized Key-Value (KV) Store for managing configuration across all microservices. Configuration is loaded with the following priority:

1. **Environment Variables** (highest priority)
2. **Consul KV Store**
3. **.env file** (fallback)
4. **Hardcoded defaults** (lowest priority)

This resilient design ensures services continue running even if Consul is unavailable by falling back to .env files.

## Architecture

### Services Using Consul Config

All 8 microservices load configuration from Consul on startup:
- `identity-service`
- `user-service`
- `exam-service`
- `question-service`
- `course-service`
- `notification-service`
- `analytics-service`
- `simulation-service`

### KV Structure

Configuration is organized hierarchically in Consul KV Store:

```
/config/{environment}/{service}/{key}
```

**Example paths:**
```
/config/development/identity-service/database.url
/config/development/identity-service/database.poolSize
/config/development/identity-service/rabbitmq.url
/config/production/identity-service/database.url
```

**Environment levels:**
- `development` - Local development environment
- `staging` - Staging/pre-production environment
- `production` - Production environment

**Shared configuration:**
```
/config/{environment}/shared/log.level
/config/{environment}/shared/log.format
/config/{environment}/shared/node_env
```

## Getting Started

### 1. Start Consul

All services automatically depend on Consul. When you run the services with Docker Compose:

```bash
docker-compose up
```

Consul starts automatically on port 8500.

### 2. Access Consul UI

Open your browser and navigate to the Consul UI:
```
http://localhost:8500
```

You can browse the KV Store:
- Navigate to **Key/Value** section
- Explore keys under `/config/development/`

### 3. Seed Configuration

Khi Consul khởi động, service `consul-init` sẽ tự động chạy `docker/consul/init.sh` để seed cấu hình vào KV Store. Script chờ Consul healthy trước khi seed.

Kiểm tra logs để xác nhận:

```bash
docker-compose logs consul-init
# Expected output:
# [Consul] ✓ Consul is ready!
# [Consul] Seeding configuration KV store...
# [Consul] ✓ Configuration seeding completed!
```

Seed file sử dụng:

- `consul-seed-development.json` - Cấu hình môi trường development
- `consul-seed-production.json` - Cấu hình môi trường production (cần thay `${SECRET_*}` trước khi dùng)

## Configuration Files

### consul-seed-development.json

Development seed file with local Docker container hostnames:

```json
{
  "shared": {
    "log.level": "debug",
    "log.format": "json",
    "node_env": "development"
  },
  "identity-service": {
    "database.url": "postgresql://user:password@db-identity:5432/identity_db",
    "database.poolSize": 10,
    "rabbitmq.url": "amqp://guest:guest@rabbitmq:5672"
  }
  // ... other services
}
```

### consul-seed-production.json

Production seed file with environment variable placeholders for secrets:

```json
{
  "shared": {
    "log.level": "info",
    "log.format": "json",
    "node_env": "production"
  },
  "identity-service": {
    "database.url": "${SECRET_IDENTITY_DATABASE_URL}",
    "database.poolSize": 20,
    "rabbitmq.url": "${SECRET_RABBITMQ_URL}"
  }
  // ... other services
}
```

Replace `${SECRET_*}` placeholders with actual values before deploying to production.

## Console Management Scripts

Use these npm scripts to manage Consul configuration:

### Seed Configuration

Populate Consul KV Store from a seed file:

```bash
# Seed development environment (mặc định)
npm run consul:seed

# Seed môi trường cụ thể (truyền thẳng tên env làm argument)
npm run consul:seed development
npm run consul:seed production
```

### List Keys

List all configuration keys under a prefix:

```bash
# List all development config
npm run consul:list /config/development

# List identity-service config only
npm run consul:list /config/development/identity-service

# List all shared config
npm run consul:list /config/development/shared
```

**Output example:**
```
Key: /config/development/identity-service/database.url
Value: postgresql://user:password@db-identity:5432/identity_db

Key: /config/development/identity-service/database.poolSize
Value: 10
```

### Get Single Key

Get the value of a specific configuration key:

```bash
npm run consul:get /config/development/identity-service/database.url
```

**Output example:**
```
Key: /config/development/identity-service/database.url
Value: postgresql://user:password@db-identity:5432/identity_db
```

## Using Configuration in Services

### Service Application Module

Each service uses `ConfigModule.forRootAsync()` with `ConsulConfigFactory`:

```typescript
// apps/identity-service/src/app.module.ts
import { ConfigModule } from '@nestjs/config';
import { ConsulConfigFactory } from '@repo/common';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRootAsync({
      useFactory: () => ConsulConfigFactory.create(
        Joi.object({
          nodeEnv: Joi.string()
            .valid('development', 'staging', 'production')
            .default('development'),
          port: Joi.number().default(3000),
          database: Joi.object({
            url: Joi.string().required(),
            poolSize: Joi.number().default(10),
            connectionTimeout: Joi.number().default(5000),
          }).optional(),
          rabbitmq: Joi.object({
            url: Joi.string().required(),
            username: Joi.string().default('guest'),
            password: Joi.string().default('guest'),
          }).optional(),
        }).unknown(true),
        'identity-service',
      ),
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

### Injecting Configuration

Access configuration in any service using NestJS `ConfigService`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService {
  constructor(private configService: ConfigService) {}

  connect() {
    const dbUrl = this.configService.get<string>('database.url');
    const poolSize = this.configService.get<number>('database.poolSize');
    
    // Use values to establish database connection
  }
}
```

### Configuration Loading Flow

When a service starts:

1. **ConsulConfigFactory.create()** is called
2. **Health check**: Attempts to reach Consul at `http://consul:8500`
3. **If Consul is healthy**:
   - Loads config from Consul KV Store at `/config/{environment}/{service}/*`
   - Base64 decodes values (Consul stores as base64)
   - Merges with OS environment variables (env vars take priority)
4. **If Consul is unhealthy or unreachable**:
   - Falls back to loading from `.env` file
   - Logs warning about using fallback
5. **Validation**: Each config value is validated against Joi schema
6. **Result**: ConfigService has merged config ready for injection

## Environment Variables

The `CONSUL_URL` and `ENVIRONMENT` variables control Consul behavior:

### CONSUL_URL

Default: `http://consul:8500`

Used to connect to Consul KV Store:
```bash
# Docker Compose automatically sets this to service name
CONSUL_URL=http://consul:8500

# For remote Consul
CONSUL_URL=http://consul-server.example.com:8500
```

### ENVIRONMENT

Default: `development`

Determines which KV path prefix to load from:
```bash
# Load from /config/development/*
ENVIRONMENT=development

# Load from /config/staging/*
ENVIRONMENT=staging

# Load from /config/production/*
ENVIRONMENT=production
```

## Troubleshooting

### Services Not Starting

**Problem**: Services fail to start with config errors

**Solution**:
1. Check Consul is running: `docker-compose ps`
2. Verify Consul UI is accessible: http://localhost:8500
3. Check initialization logs: `docker-compose logs consul`
4. Ensure seed data was loaded: `npm run consul:list /config/development`

### Consul Connection Timeout

**Problem**: Services timeout trying to connect to Consul

**Solution**:
1. Verify `CONSUL_URL` environment variable is correct
2. Check Consul container is healthy: `docker-compose ps`
3. Review logs: `docker-compose logs identity-service` (look for Consul errors)
4. If Consul is down, services will use `.env` fallback (check .env file exists)

### Missing Configuration Keys

**Problem**: Service complains about missing or invalid config

**Solution**:
1. List available keys: `npm run consul:list /config/development/SERVICE_NAME`
2. Verify expected keys exist
3. Check key names match service code (case-sensitive)
4. Re-seed if needed: `npm run consul:seed`

### Values Not Updating

**Problem**: Consul values changed but service still uses old values

**Solution**:
1. Services load config on startup - restart service to pick up changes
2. Manually update key: Use Consul UI to edit value directly
3. Verify update: `npm run consul:get /config/development/SERVICE_NAME/key`
4. Restart service: `docker-compose restart SERVICE_NAME`

### Service Uses .env Instead of Consul

**Problem**: Configuration comes from .env file despite Consul running

**Solution**:
1. This is fallback behavior - happens when service can't reach Consul
2. Check `docker-compose logs SERVICE_NAME` for Consul connection errors
3. Verify `CONSUL_URL` is set to correct address
4. Start Consul: `docker-compose up consul`
5. Restart service: `docker-compose restart SERVICE_NAME`

## Production Deployment

### 1. Update Seed File

Replace all `${SECRET_*}` placeholders in `consul-seed-production.json` with actual values:

```json
{
  "identity-service": {
    "database.url": "postgresql://user:pass@prod-db.example.com:5432/identity_db",
    "rabbitmq.url": "amqp://user:pass@prod-rabbitmq.example.com:5672"
  }
}
```

### 2. Seed Production Consul

```bash
ENVIRONMENT=production npm run consul:seed
```

### 3. Deploy Services

Services will automatically load from Consul at startup.

### 4. Verify Configuration

```bash
# List all production keys
npm run consul:list /config/production

# Get specific service config
npm run consul:list /config/production/identity-service
```

## Best Practices

1. **Always use Joi validation** - Define schema for all configuration
2. **Use hierarchical keys** - Organize keys by service and component
3. **Keep secrets in Consul** - Store sensitive values (DB passwords, API keys)
4. **Use environment variables for overrides** - Env vars take precedence
5. **Document required configuration** - List required keys in service README
6. **Test configuration changes** - Verify with `consul:get` before restarting services
7. **Monitor Consul health** - Check Consul is running before deploying
8. **Use fallback .env files** - Keep .env files as backup for development

## Additional Resources

- [Consul Documentation](https://www.consul.io/docs)
- [Consul KV Store](https://www.consul.io/api-docs/kv)
- [NestJS Config Module](https://docs.nestjs.com/techniques/configuration)
- [Environment Variables Best Practices](https://12factor.net/config)
