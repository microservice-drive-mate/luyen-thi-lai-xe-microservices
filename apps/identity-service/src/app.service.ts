import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  createJwtAccessToken,
  JWT_CLIENTS,
  type JwtClientName,
} from './auth/jwt-token.util';
import { PrismaService } from './prisma/prisma.service';

export type LoginRequest = {
  email: string;
  name?: string;
  client: JwtClientName;
};

@Injectable()
export class AppService {
  constructor(
    @Inject('NOTI_SERVICE') private readonly client: ClientProxy,
    private readonly prisma: PrismaService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async healthCheck() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected' };
  }

  async login(loginDto: LoginRequest) {
    const clientConfig = JWT_CLIENTS[loginDto.client];
    if (!clientConfig) {
      throw new BadRequestException('Unsupported client');
    }

    const email = loginDto.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const name = loginDto.name?.trim() || email.split('@')[0] || 'User';

    const user = await this.prisma.identityUser.upsert({
      where: { email },
      update: { name },
      create: {
        email,
        name,
      },
    });

    const { token, expiresAt } = createJwtAccessToken({
      issuer: clientConfig.issuer,
      secret: clientConfig.secret,
      subject: user.id,
      email: user.email,
      name: user.name,
      client: loginDto.client,
    });

    return {
      message: 'Login successful',
      tokenType: 'Bearer',
      expiresAt,
      accessToken: token,
      user,
    };
  }

  async createUser(userDto: { email: string; name: string }) {
    const user = await this.prisma.identityUser.upsert({
      where: { email: userDto.email },
      update: { name: userDto.name },
      create: {
        email: userDto.email,
        name: userDto.name,
      },
    });

    this.client.emit('user_created', {
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      message: 'User persisted and notification triggered',
      user,
    };
  }
}
