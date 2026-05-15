import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    const response = await fetch(`${baseUrl}/users/me`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok)
      throw new Error(`User profile request failed: ${response.status}`);
    const envelope = (await response.json()) as ApiEnvelope<StudentProfile>;
    if (!envelope.data) throw new Error('User profile response missing data');
    return envelope.data;
  }
}
