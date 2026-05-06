export * from "./http-api";

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

// ============== SWAGGER =========================
export * from './config/swagger.setup';
