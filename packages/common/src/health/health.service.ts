import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as net from 'node:net';
import { HEALTH_MODULE_OPTIONS } from './health.constants';

export type HealthDependencyKind = 'url' | 'http';

export interface HealthDependencyOptions {
  name: string;
  configKey: string;
  kind?: HealthDependencyKind;
  timeoutMs?: number;
}

export interface HealthModuleOptions {
  serviceName: string;
  dependencies?: HealthDependencyOptions[];
}

export interface HealthLivenessReport {
  service: string;
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
  pid: number;
  memory: NodeJS.MemoryUsage;
}

export interface HealthDependencyReport {
  name: string;
  status: 'ok' | 'error' | 'skipped';
  target?: string;
  latencyMs?: number;
  error?: string;
}

export interface HealthReadinessReport {
  service: string;
  status: 'ok' | 'error';
  timestamp: string;
  checks: HealthDependencyReport[];
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(HEALTH_MODULE_OPTIONS)
    private readonly options: HealthModuleOptions,
    private readonly configService: ConfigService,
  ) {}

  getLivenessReport(): HealthLivenessReport {
    return {
      service: this.options.serviceName,
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      pid: process.pid,
      memory: process.memoryUsage(),
    };
  }

  async getReadinessReport(): Promise<HealthReadinessReport> {
    const checks = await Promise.all(
      (this.options.dependencies ?? []).map((dependency) =>
        this.checkDependency(dependency),
      ),
    );

    return {
      service: this.options.serviceName,
      status: checks.every((check) => check.status !== 'error')
        ? 'ok'
        : 'error',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkDependency(
    dependency: HealthDependencyOptions,
  ): Promise<HealthDependencyReport> {
    const target = this.configService.get<string>(dependency.configKey)?.trim();
    if (!target) {
      return {
        name: dependency.name,
        status: 'skipped',
      };
    }

    const startedAt = Date.now();

    try {
      if (dependency.kind === 'http') {
        await axios.get(target, {
          timeout: dependency.timeoutMs ?? 1500,
          validateStatus: (status) => status < 500,
        });
      } else {
        await this.checkSocket(target, dependency.timeoutMs ?? 1500);
      }

      return {
        name: dependency.name,
        status: 'ok',
        target,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        name: dependency.name,
        status: 'error',
        target,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkSocket(target: string, timeoutMs: number): Promise<void> {
    const parsedUrl = new URL(target);
    const host = parsedUrl.hostname;
    const port = parsedUrl.port
      ? Number(parsedUrl.port)
      : this.resolveDefaultPort(parsedUrl.protocol);

    if (!host || !port) {
      throw new Error(`Cannot resolve socket target: ${target}`);
    }

    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => {
        cleanup();
        resolve();
      });
      socket.once('timeout', () => {
        cleanup();
        reject(new Error(`Connection timeout after ${timeoutMs}ms`));
      });
      socket.once('error', (error) => {
        cleanup();
        reject(error);
      });

      socket.connect(port, host);
    });
  }

  private resolveDefaultPort(protocol: string): number | null {
    switch (protocol) {
      case 'http:':
        return 80;
      case 'https:':
        return 443;
      case 'postgres:':
      case 'postgresql:':
        return 5432;
      case 'amqp:':
      case 'amqps:':
        return 5672;
      case 'redis:':
      case 'rediss:':
        return 6379;
      default:
        return null;
    }
  }
}
