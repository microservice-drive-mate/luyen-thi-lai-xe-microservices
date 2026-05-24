import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resilientFetch } from '@repo/common';
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
    const timeoutMs =
      this.configService.get<number>('services.question.timeoutMs') ?? 3_000;
    const token = await this.tokenService.getServiceToken();
    const response = await resilientFetch(
      `${baseUrl}/admin/questions/pool`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
      },
      {
        serviceName: 'exam-service',
        dependencyName: 'question-service',
        timeoutMs,
      },
    );
    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(
        `Question pool request failed: ${response.status} ${responseBody}`,
      );
    }
    const envelope = (await response.json()) as ApiEnvelope<{
      items: QuestionPoolItem[];
    }>;
    return envelope.data?.items ?? [];
  }
}
