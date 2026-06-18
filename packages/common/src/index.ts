export * from './audit/audit.types';
export * from './audit/audit-context';
export * from './audit/audit-event.factory';
// ============== DDD BASE CLASSES =================
export * from './ddd';
export * from './http/access-log.interceptor';
export * from './http/correlation-context';
export * from './http/correlation-id.interceptor';
export * from './http/correlation-id.middleware';
export * from './http/resilient-http-client';
export * from './http-api';
export * from './runtime/transient-error.guard';

/**
 * @repo/common - Shared utilities, services, and configuration
 * Main entry point for all shared modules
 */

export { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
export * from './auth/token-blacklist.guard';
export * from './auth/token-blacklist.module';
// ============== AUTH ============================
export * from './auth/token-blacklist.service';
// ============== SWAGGER =========================
export * from './config/cors.setup';
export * from './config/swagger.setup';
// ============== CONSUL CONFIGURATION ==============
export { ConsulConfigFactory, ConsulConfigService } from './consul';
// ============== HEALTH ==========================
export * from './health';
// ============== LOGGER ==========================
export * from './logger/logger.module';
// ============== MESSAGING =======================
export * from './messaging';
// ============== METRICS =========================
export * from './metrics';
// ============== TRACING =========================
export * from './tracing';
