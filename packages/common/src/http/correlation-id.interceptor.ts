import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import {
  createCorrelationId,
  getCurrentCorrelationId,
  resolveHttpCorrelationId,
  resolveMessageCorrelationId,
  runWithCorrelationId,
} from './correlation-context';

interface RmqMessageLike {
  properties?: {
    headers?: Record<string, unknown>;
  };
}

interface RmqContextLike {
  getMessage?: () => RmqMessageLike;
}

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const correlationId =
      this.resolveCorrelationId(context) ??
      getCurrentCorrelationId() ??
      createCorrelationId();

    return new Observable((subscriber) =>
      runWithCorrelationId(correlationId, () => {
        const subscription = next.handle().subscribe(subscriber);
        return () => subscription.unsubscribe();
      }),
    );
  }

  private resolveCorrelationId(context: ExecutionContext): string | undefined {
    if (context.getType() === 'http') {
      return resolveHttpCorrelationId(
        context.switchToHttp().getRequest<Request>(),
      );
    }

    if (context.getType() !== 'rpc') {
      return undefined;
    }

    const rpc = context.switchToRpc();
    const payload = rpc.getData<unknown>();
    const rmqContext = rpc.getContext<RmqContextLike>();
    const headers = rmqContext.getMessage?.().properties?.headers;

    return resolveMessageCorrelationId(payload, headers);
  }
}
