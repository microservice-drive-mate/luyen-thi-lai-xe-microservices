import { Injectable } from '@nestjs/common';

/**
 * Service để quản lý blacklist JWT token sau khi logout
 * Hiện dùng in-memory Map, sẽ thay bằng Redis trong tương lai
 */
@Injectable()
export class TokenBlacklistService {
  // Tạm dùng in-memory Map, sau sẽ thay bằng Redis
  private blacklist: Map<string, number> = new Map();

  /**
   * Thêm token vào blacklist với TTL cụ thể
   * @param token JWT token string
   * @param expiresAt Unix timestamp khi token hết hạn
   */
  addToBlacklist(token: string, expiresAt: number): void {
    // Tính TTL còn lại (seconds)
    const now = Math.floor(Date.now() / 1000);
    const ttl = expiresAt - now;

    if (ttl <= 0) {
      // Token đã hết hạn, không cần blacklist
      return;
    }

    // Lưu vào memory với expiration time
    this.blacklist.set(token, expiresAt);

    // TODO: Khi integrate Redis:
    // await this.redis.setex(
    //   `blacklist:${token}`,
    //   ttl,
    //   JSON.stringify({ addedAt: now })
    // );

    // Set timeout để xóa khỏi memory khi hết TTL
    setTimeout(() => {
      this.blacklist.delete(token);
    }, ttl * 1000);
  }

  /**
   * Kiểm tra token có bị blacklist không
   * @param token JWT token string
   * @returns true nếu token bị blacklist, false nếu còn hợp lệ
   */
  isBlacklisted(token: string): boolean {
    // Check in-memory
    const expiresAt = this.blacklist.get(token);
    if (expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      if (now < expiresAt) {
        return true;
      } else {
        // Token đã hết hạn, xóa khỏi blacklist
        this.blacklist.delete(token);
      }
    }

    // TODO: Khi integrate Redis:
    // const isBlacklisted = await this.redis.exists(`blacklist:${token}`);
    // return isBlacklisted === 1;

    return false;
  }

  /**
   * Xóa token khỏi blacklist (nếu cần undo logout)
   */
  removeFromBlacklist(token: string): void {
    this.blacklist.delete(token);
    // TODO: await this.redis.del(`blacklist:${token}`);
  }

  /**
   * Lấy số token đang bị blacklist (cho monitoring)
   */
  getBlacklistSize(): number {
    return this.blacklist.size;
  }
}
