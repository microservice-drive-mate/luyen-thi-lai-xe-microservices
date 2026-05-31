export * from './http-api';
export * from './http/access-log.interceptor';
export * from './http/correlation-context';
export * from './http/correlation-id.interceptor';
export * from './http/correlation-id.middleware';
export * from './http/resilient-http-client';
export * from './runtime/transient-error.guard';
export * from './audit/audit-context';
export * from './audit/audit-event.factory';
export * from './audit/audit.types';

// ============== DDD BASE CLASSES =================
export * from './ddd';

/**
 * @repo/common - Shared utilities, services, and configuration
 * Main entry point for all shared modules
 */

// ============== CONSUL CONFIGURATION ==============
export { ConsulConfigService, ConsulConfigFactory } from './consul';

// ============== LOGGER ==========================
export * from './logger/logger.module';
export { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

// ============== HEALTH ==========================
export * from './health';

// ============== METRICS =========================
export * from './metrics';

// ============== MESSAGING =======================
export * from './messaging';

// ============== TRACING =========================
export * from './tracing';

// ============== SWAGGER =========================
export * from './config/cors.setup';
export * from './config/swagger.setup';

// ============== AUTH ============================
export * from './auth/token-blacklist.service';
export * from './auth/token-blacklist.guard';
export * from './auth/token-blacklist.module';
