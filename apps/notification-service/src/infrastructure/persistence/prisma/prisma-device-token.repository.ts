import { Injectable } from '@nestjs/common';
import {
  DeviceToken,
  DeviceTokenRecord,
  DeviceTokenRepository,
} from '../../../domain/repositories/device-token.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaDeviceTokenRepository extends DeviceTokenRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async upsert(token: DeviceToken): Promise<DeviceTokenRecord> {
    const snapshot = token.toSnapshot();
    return this.prisma.deviceToken.upsert({
      where: { token: snapshot.token },
      create: {
        id: snapshot.id,
        userId: snapshot.userId,
        token: snapshot.token,
        platform: snapshot.platform,
      },
      update: { userId: snapshot.userId, platform: snapshot.platform },
    });
  }

  async findByUser(userId: string): Promise<DeviceTokenRecord[]> {
    return this.prisma.deviceToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteByToken(token: string): Promise<void> {
    await this.prisma.deviceToken
      .delete({ where: { token } })
      .catch(() => undefined);
  }

  async deleteByUserAndToken(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({
      where: { userId, token },
    });
  }

  async deleteManyTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.prisma.deviceToken.deleteMany({
      where: { token: { in: tokens } },
    });
  }
}
