import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import { parseAllowedOrigins } from "./allowed-origins.js";

/** Shared by the real bootstrap and HTTP tests. */
export function configureHttpSecurity(app: INestApplication): void {
  const config = app.get(ConfigService);
  const origins = parseAllowedOrigins(
    config.getOrThrow<string>("ALLOWED_ORIGINS"),
    config.get<string>("NODE_ENV") ?? "development",
  );
  app.use(
    (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const path = (request.url?.split("?")[0] ?? "").replace(/\/+$/u, "");
      if (path.startsWith("/api/v1/auth/") || path === "/api/v1/users/me") {
        response.setHeader("Cache-Control", "no-store");
      }
      const origin = request.headers.origin;
      // CORS response headers alone do not prevent a mutation from executing.
      if (origin !== undefined && !origins.includes(origin)) {
        response.statusCode = 403;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(
          JSON.stringify({
            error: {
              code: "FORBIDDEN",
              message: "Origin không được phép.",
              httpStatus: 403,
            },
          }),
        );
        return;
      }
      next();
    },
  );
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Request-Origin"],
  });
}
