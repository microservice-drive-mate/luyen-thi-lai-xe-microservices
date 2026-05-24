import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resilientFetch } from '@repo/common';
import {
  StudentProfile,
  UserProfileClient,
} from '../../application/ports/user-profile.client';

interface ApiEnvelope<T> {
  data?: T;
}

@Injectable()
export class HttpUserProfileClient extends UserProfileClient {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async getCurrentStudentProfile(accessToken: string): Promise<StudentProfile> {
    const baseUrl =
      this.configService.get<string>('services.user.baseUrl') ??
      'http://localhost:3002';
    const timeoutMs =
      this.configService.get<number>('services.user.timeoutMs') ?? 3_000;
    const response = await resilientFetch(
      `${baseUrl}/users/me`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
      },
      {
        serviceName: 'exam-service',
        dependencyName: 'user-service',
        timeoutMs,
      },
    );
    if (!response.ok)
      throw new Error(`User profile request failed: ${response.status}`);
    const envelope = (await response.json()) as ApiEnvelope<StudentProfile>;
    if (!envelope.data) throw new Error('User profile response missing data');
    return envelope.data;
  }
}
