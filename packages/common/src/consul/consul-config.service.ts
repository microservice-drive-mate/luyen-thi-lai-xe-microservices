import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";

/**
 * Consul Configuration Service
 * Fetches configuration from Consul KV Store
 */
@Injectable()
export class ConsulConfigService {
  private readonly logger = new Logger(ConsulConfigService.name);
  private consulClient: AxiosInstance;
  private readonly consulUrl: string;
  private configCache: Map<string, string> = new Map();

  constructor(
    consulUrl: string = process.env.CONSUL_URL || "http://localhost:8500",
  ) {
    this.consulUrl = consulUrl;
    this.consulClient = axios.create({
      baseURL: this.consulUrl,
      timeout: 5000,
    });
  }

  private toMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Check if Consul is available
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.consulClient.get("/v1/status/leader");
      return response.status === 200;
    } catch {
      this.logger.warn("Consul health check failed");
      return false;
    }
  }

  /**
   * Get single KV value from Consul
   * @param key - KV path (e.g. "config/development/identity-service/database.url")
   * @param decodeBase64 - If true, decode base64 value (default: true)
   */
  async get(key: string, decodeBase64: boolean = true): Promise<string | null> {
    try {
      if (this.configCache.has(key)) {
        return this.configCache.get(key) ?? null;
      }

      const response = await this.consulClient.get(`/v1/kv/${key}`);
      if (!response.data || response.data.length === 0) {
        return null;
      }

      const kvData = response.data[0];
      const value = decodeBase64
        ? Buffer.from(kvData.Value, "base64").toString("utf-8")
        : kvData.Value;

      this.configCache.set(key, value);
      return value;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.logger.error(
        `Failed to get key ${key} from Consul:`,
        this.toMessage(error),
      );
      throw error;
    }
  }

  /**
   * Get all KV values matching a prefix pattern
   * @param prefix - KV prefix (e.g. "config/development/identity-service/")
   */
  async getByPrefix(prefix: string): Promise<Record<string, string>> {
    try {
      const response = await this.consulClient.get(`/v1/kv/${prefix}?recurse`);
      if (!response.data) {
        return {};
      }

      const configMap: Record<string, string> = {};
      response.data.forEach((kvData: { Key: string; Value: string }) => {
        const key = kvData.Key;
        const value = Buffer.from(kvData.Value, "base64").toString("utf-8");
        configMap[key] = value;
      });

      return configMap;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {};
      }
      this.logger.error(
        `Failed to get prefix ${prefix} from Consul:`,
        this.toMessage(error),
      );
      throw error;
    }
  }

  /**
   * Set KV value in Consul (mostly for testing/debugging)
   */
  async set(key: string, value: string): Promise<boolean> {
    try {
      const response = await this.consulClient.put(`/v1/kv/${key}`, value);
      if (response.status === 200) {
        this.configCache.set(key, value);
        this.logger.log(`Set Consul KV: ${key} = ${value}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(
        `Failed to set key ${key} in Consul:`,
        this.toMessage(error),
      );
      throw error;
    }
  }

  /**
   * Delete KV value from Consul
   */
  async delete(key: string): Promise<boolean> {
    try {
      const response = await this.consulClient.delete(`/v1/kv/${key}`);
      if (response.status === 200) {
        this.configCache.delete(key);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(
        `Failed to delete key ${key} from Consul:`,
        this.toMessage(error),
      );
      throw error;
    }
  }

  /**
   * List all keys under a prefix
   */
  async listKeys(prefix: string): Promise<string[]> {
    try {
      const response = await this.consulClient.get(
        `/v1/kv/${prefix}?recurse=true&keys`,
      );
      if (!response.data) {
        return [];
      }
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      this.logger.error(
        `Failed to list keys under ${prefix}:`,
        this.toMessage(error),
      );
      throw error;
    }
  }

  /**
   * Clear local cache (force reload from Consul on next get)
   */
  clearCache(): void {
    this.configCache.clear();
    this.logger.log("Consul config cache cleared");
  }

  async getRegisteredServices(): Promise<string[]> {
    try {
      const response = await this.consulClient.get("/v1/catalog/services");
      return Object.keys(response.data);
    } catch (error) {
      this.logger.error(
        "Failed to get services from Consul Catalog",
        this.toMessage(error),
      );
      return [];
    }
  }
}
