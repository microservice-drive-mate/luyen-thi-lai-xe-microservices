export * from './http-api';

/**
 * @repo/common - Shared utilities, services, and configuration
 * Main entry point for all shared modules
 */

// ============== CONSUL CONFIGURATION ==============
export { ConsulConfigService, ConsulConfigFactory } from './consul';
export * from './config/swagger.setup';
