import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConsulConfigFactory } from "@repo/common";
import Joi from "joi";

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [
        ConsulConfigFactory.create(
          Joi.object({
            nodeEnv: Joi.string()
              .valid(
                "development",
                "development-local",
                "staging",
                "production",
              )
              .default("development"),
            port: Joi.number().default(3009),
            swagger: Joi.object({
              services: Joi.string().optional(),
            }).optional(),
          }).unknown(true),
          "docs-service",
        ),
      ],
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
