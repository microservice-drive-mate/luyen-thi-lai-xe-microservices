/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AppService {
  constructor(private readonly httpService: HttpService) {}
  getHello(): string {
    return 'Hello World!';
  }

  async login(username: string, password: string) {
    const url =
      'http://keycloak:8080/realms/luyen-thi-lai-xe-realm/protocol/openid-connect/token';

    // Keycloak yêu cầu format x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', 'nestjs-backend');
    params.append('client_secret', 'FkUamLTRQOOAcRyLN4qaiPceoM5g8dwJ'); // Secret từ bước 2.3
    params.append('username', username);
    params.append('password', password);

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, params.toString(), {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }),
      );
      return response.data; // Trả về access_token, refresh_token
    } catch (e) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }
  }
}
