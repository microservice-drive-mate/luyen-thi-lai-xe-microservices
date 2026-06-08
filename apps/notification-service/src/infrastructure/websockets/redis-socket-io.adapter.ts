import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis, { RedisOptions } from 'ioredis';
import { Server, ServerOptions } from 'socket.io';

export class RedisSocketIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisSocketIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  constructor(
    app: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl =
      this.configService.get<string>('redis.url') ?? 'redis://localhost:6379';
    const options: RedisOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    };

    this.pubClient = new Redis(redisUrl, options);
    this.subClient = this.pubClient.duplicate();
    this.pubClient.on('error', (error) =>
      this.logger.error(`Socket.IO Redis pub error: ${error.message}`),
    );
    this.subClient.on('error', (error) =>
      this.logger.error(`Socket.IO Redis sub error: ${error.message}`),
    );

    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
    this.logger.log(
      `Socket.IO Redis adapter connected to ${this.redactRedisUrl(redisUrl)}`,
    );
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (!this.adapterConstructor) {
      throw new Error('Socket.IO Redis adapter was not initialized');
    }
    server.adapter(this.adapterConstructor);
    return server;
  }

  async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.allSettled([this.pubClient?.quit(), this.subClient?.quit()]);
  }

  private redactRedisUrl(value: string): string {
    try {
      const url = new URL(value);
      if (url.username) url.username = '***';
      if (url.password) url.password = '***';
      return url.toString();
    } catch {
      return '<redis-url>';
    }
  }
}
