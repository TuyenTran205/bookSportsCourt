import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter.js";
import { TransformResponseInterceptor } from "./common/interceptors/transform-response.interceptor.js";
import { configureHttpSecurity } from "./config/http-security.js";

const SWAGGER_ENVIRONMENTS = new Set(["development", "staging"]);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);
  const nodeEnvironment =
    configService.get<string>("NODE_ENV") ?? "development";

  app.setGlobalPrefix("api/v1");
  configureHttpSecurity(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  if (SWAGGER_ENVIRONMENTS.has(nodeEnvironment)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("BookSportsCourt API")
      .setDescription("API đặt sân thể thao BookSportsCourt")
      .setVersion("1.0")
      .addCookieAuth("access_token", { type: "apiKey" }, "access_token")
      .addCookieAuth("refresh_token", { type: "apiKey" }, "refresh_token")
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup("api/docs", app, document);
  }

  const port = configService.getOrThrow<number>("PORT");
  await app.listen(port);
}

void bootstrap();
