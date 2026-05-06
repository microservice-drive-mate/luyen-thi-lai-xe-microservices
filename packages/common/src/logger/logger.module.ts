import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: () => {
        const transports: winston.transport[] = [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.ms(),
              winston.format.colorize(),
              winston.format.printf(
                ({ timestamp, level, message, context, ms }) => {
                  return `[${timestamp as string}] ${level} [${(context as string) || 'Application'}]: ${message as string} ${ms as string}`;
                },
              ),
            ),
          }),
        ];

        // Using standard HTTP transport to send logs to Logstash
        transports.push(
          new winston.transports.Http({
            host: process.env.LOGSTASH_HOST || 'localhost',
            port: process.env.LOGSTASH_PORT
              ? parseInt(process.env.LOGSTASH_PORT, 10)
              : 5044,
            path: '/',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
        );

        return {
          transports,
        };
      },
    }),
  ],
  exports: [WinstonModule],
})
export class AppLoggerModule {}
