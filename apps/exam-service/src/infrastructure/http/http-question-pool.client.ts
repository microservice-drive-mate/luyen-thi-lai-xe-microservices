import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  QuestionPoolClient,
  QuestionPoolItem,
  QuestionPoolRequest,
} from '../../application/ports/question-pool.client';
import { KeycloakTokenService } from './keycloak-token.service';

interface ApiEnvelope<T> {
  data?: T;
}

@Injectable()
export class HttpQuestionPoolClient extends QuestionPoolClient {
  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: KeycloakTokenService,
  ) {
    super();
  }

  async getPool(request: QuestionPoolRequest): Promise<QuestionPoolItem[]> {
    const baseUrl =
      this.configService.get<string>('services.question.baseUrl') ??
      'http://localhost:3005';
    const token = await this.tokenService.getServiceToken();
    const response = await fetch(`${baseUrl}/admin/questions/pool`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    if (!response.ok)
      throw new Error(`Question pool request failed: ${response.status}`);
    const envelope = (await response.json()) as ApiEnvelope<{
      items: QuestionPoolItem[];
    }>;
    return envelope.data?.items ?? [];
  }
}
