import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { TokenBlacklistGuard } from './token-blacklist.guard';
import {
  BLACKLIST_REDIS_CLIENT,
  TokenBlacklistService,
} from './token-blacklist.service';

@Global()
@Module({
  providers: [
    TokenBlacklistService,
    TokenBlacklistGuard,
    {
      provide: BLACKLIST_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>('redis.url') ?? 'redis://localhost:6379';
        return new Redis(redisUrl);
      },
    },
  ],
  exports: [TokenBlacklistService, TokenBlacklistGuard, BLACKLIST_REDIS_CLIENT],
})
export class TokenBlacklistModule {}
