/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { ConsulConfigService } from "@repo/common";

async function isServiceAlive(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>("port") ?? 3009;
  const consulUrl = process.env.CONSUL_URL || "http://localhost:8500";
  const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:8000";

  let candidates: { name: string; url: string }[] = [];

  // Priority 1: swagger.services từ Consul KV — local dev, bypass Kong
  // Consul key: config/development-local/docs-service/swagger.services
  // Format: "service-name:port,service-name:port"
  const swaggerServicesConfig = configService.get<string>("swagger.services");
  if (swaggerServicesConfig) {
    candidates = swaggerServicesConfig
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const [name, svcPort = "3000"] = entry.split(":");
        return {
          name: name
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          url: `http://localhost:${svcPort}/docs-json`,
        };
      });
  }

  // Priority 2: Consul catalog auto-discovery → qua Kong gateway
  if (candidates.length === 0) {
    const consulService = new ConsulConfigService(consulUrl);
    const registeredServices = await consulService.getRegisteredServices();
    candidates = registeredServices
      .filter(
        (name) =>
          name.endsWith("-service") &&
          name !== "docs-service" &&
          name !== "identity-service",
      )
      .map((name) => ({
        name: name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        url: `${gatewayUrl}/${name}/docs-json`,
      }));
  }

  // Probe từng service — chỉ hiện service đang thực sự chạy
  const probeResults = await Promise.all(
    candidates.map(async (entry) => ({
      ...entry,
      alive: await isServiceAlive(entry.url),
    })),
  );

  const swaggerUrls = probeResults
    .filter((e) => e.alive)
    .map(({ alive: _alive, ...rest }) => rest);

  const dead = probeResults.filter((e) => !e.alive).map((e) => e.name);
  if (dead.length > 0) {
    console.log(`ℹ Services not running (excluded): ${dead.join(", ")}`);
  }

  if (swaggerUrls.length === 0) {
    console.warn("⚠ No services are currently running.");
  } else {
    console.log(
      `✓ Active services: ${swaggerUrls.map((u) => u.name).join(", ")}`,
    );
  }

  const swaggerOptions = {
    explorer: true,
    ...(swaggerUrls.length > 0 && {
      swaggerOptions: { urls: swaggerUrls },
    }),
  };

  const dummyDocument = {
    openapi: "3.0.0",
    info: { title: "Centralized API Documentation", version: "1.0.0" },
    paths: {},
  };

  SwaggerModule.setup("docs", app, dummyDocument, swaggerOptions);

  await app.listen(port);
  console.log(`✓ Docs Service Swagger UI: http://localhost:${port}/docs`);
}
bootstrap();
