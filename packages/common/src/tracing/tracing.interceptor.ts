import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  context as otelContext,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { Observable } from 'rxjs';
import { isOpenTelemetryEnabled } from './opentelemetry';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(private readonly serviceName: string) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!isOpenTelemetryEnabled()) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      const tracer = trace.getTracer(this.serviceName);
      const spanName = this.resolveSpanName(context);
      const span = tracer.startSpan(spanName, {
        kind: this.resolveSpanKind(context),
        attributes: {
          'service.name': this.serviceName,
          'nestjs.context_type': context.getType<string>(),
          'nestjs.class': context.getClass().name,
          'nestjs.handler': context.getHandler().name,
        },
      });

      const spanContext = trace.setSpan(otelContext.active(), span);
      const subscription = otelContext.with(spanContext, () =>
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => {
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error instanceof Error ? error.message : 'Unknown error',
            });
            span.end();
            subscriber.error(error);
          },
          complete: () => {
            span.end();
            subscriber.complete();
          },
        }),
      );

      return () => subscription.unsubscribe();
    });
  }

  private resolveSpanName(context: ExecutionContext): string {
    const type = context.getType<string>();
    const className = context.getClass().name;
    const handlerName = context.getHandler().name;

    if (type === 'rpc') {
      return `rabbitmq ${className}.${handlerName}`;
    }

    return `${className}.${handlerName}`;
  }

  private resolveSpanKind(context: ExecutionContext): SpanKind {
    return context.getType<string>() === 'rpc'
      ? SpanKind.CONSUMER
      : SpanKind.INTERNAL;
  }
}
