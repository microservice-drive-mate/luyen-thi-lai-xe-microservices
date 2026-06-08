import {
  DeviceToken,
  DeviceTokenSnapshot,
} from '../entities/device-token.entity';

export { DeviceToken };

export type DeviceTokenRecord = DeviceTokenSnapshot;

export abstract class DeviceTokenRepository {
  abstract upsert(token: DeviceToken): Promise<DeviceTokenRecord>;

  abstract findByUser(userId: string): Promise<DeviceTokenRecord[]>;

  abstract deleteByToken(token: string): Promise<void>;

  abstract deleteByUserAndToken(userId: string, token: string): Promise<void>;

  abstract deleteManyTokens(tokens: string[]): Promise<void>;
}
