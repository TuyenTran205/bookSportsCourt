import "reflect-metadata";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";
import type {
  OperationObject,
  SchemaObject,
} from "@nestjs/swagger/dist/interfaces/open-api-spec.interface.js";
import { DATABASE, DatabaseService } from "../src/database/database.module.js";

const methods = ["get", "post", "put", "patch", "delete"] as const;
const root = new URL("../../../", import.meta.url);
const json = async (path: string) =>
  JSON.parse(await readFile(new URL(path, root), "utf8")) as OpenAPIObject;

/** Metadata-only acceptance. DB access is forbidden; SQL guarantees are tested separately. */
export async function inspectPhase4Contract(write = false) {
  const config = {
    DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
    JWT_ACCESS_SECRET: "contract-test-access-secret-at-least-32-chars",
    JWT_REFRESH_SECRET: "contract-test-refresh-secret-at-least-32-chars",
    ALLOWED_ORIGINS: "http://localhost:3000",
    NODE_ENV: "test",
    BUSINESS_MAIL_ENABLED: "false",
  };
  const previous = Object.fromEntries(
    Object.keys(config).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, config);
  const { AppModule } = await import("../src/app.module.js");
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE)
    .useValue({})
    .overrideProvider(DatabaseService)
    .useValue({
      query: () => {
        throw new Error("Contract export must not query DB");
      },
    })
    .compile();
  const app = module.createNestApplication();
  try {
    app.setGlobalPrefix("api/v1");
    await app.init();
    const runtime = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("BookSportsCourt Phase 4 runtime candidate")
        .setVersion("1.0.0-rc.1")
        .setDescription(
          "Generated from AppModule metadata. Phase 2/FE/live-provider integration remains pending; not the final Phase 4 milestone.",
        )
        .addCookieAuth("access_token", { type: "apiKey" }, "access_token")
        .addCookieAuth("refresh_token", { type: "apiKey" }, "refresh_token")
        .build(),
    );
    const design = await json("docs/openapi/phase-04.openapi.json");
    const resolve = (
      value: SchemaObject | { $ref: string } | undefined,
      document: OpenAPIObject,
    ): SchemaObject | undefined => {
      if (!value || !("$ref" in value)) return value;
      assert.ok(value.$ref.startsWith("#/components/schemas/"));
      return document.components?.schemas?.[value.$ref.split("/").at(-1)!] as
        SchemaObject | undefined;
    };
    const candidate: OpenAPIObject = {
      ...runtime,
      paths: {},
      servers: [{ url: "http://localhost:3001" }],
    };
    const discrepancies: string[] = [];
    const pending: string[] = [];
    let operations = 0;
    for (const [path, item] of Object.entries(design.paths)) {
      const fullPath = `/api/v1${path}`;
      const actual = runtime.paths[fullPath];
      if (!actual) {
        const explicitlyPlanned = methods.every(
          (method) =>
            !item?.[method] ||
            (
              item[method] as OperationObject & {
                "x-implementation-status"?: string;
              }
            )["x-implementation-status"] === "design-not-runtime",
        );
        (explicitlyPlanned ? pending : discrepancies).push(
          `Missing runtime path ${fullPath}`,
        );
        continue;
      }
      candidate.paths[fullPath] = actual;
      for (const method of methods) {
        const expected = item?.[method];
        if (!expected) continue;
        operations++;
        const operation: OperationObject | undefined = actual[method];
        assert.ok(operation, `Missing runtime method ${method} ${path}`);
        const label = `${method.toUpperCase()} ${path}`;
        for (const status of Object.keys(expected.responses).filter((s) =>
          /^[23]/.test(s),
        ))
          assert.ok(
            operation.responses[status],
            `${label}: missing success status ${status}`,
          );
        const keys = (op: OperationObject) =>
          (op.parameters ?? [])
            .flatMap((p) => ("$ref" in p ? [] : [`${p.in}:${p.name}`]))
            .sort();
        assert.equal(
          new Set(keys(operation)).size,
          keys(operation).length,
          `${label}: duplicate parameters`,
        );
        if (JSON.stringify(keys(expected)) !== JSON.stringify(keys(operation)))
          discrepancies.push(`${label}: parameters differ`);
        for (const status of Object.keys(expected.responses).filter(
          (s) => !/^2/.test(s),
        ))
          if (!operation.responses[status])
            discrepancies.push(
              `${label}: error ${status} not explicitly documented in runtime`,
            );
        const body = (op: OperationObject) =>
          op.requestBody && !("$ref" in op.requestBody)
            ? op.requestBody.content
            : undefined;
        for (const [media, request] of Object.entries(body(expected) ?? {})) {
          const wanted = resolve(request.schema, design);
          const got = resolve(body(operation)?.[media]?.schema, runtime);
          if (!got) discrepancies.push(`${label}: missing body ${media}`);
          else {
            const fields = (schema: SchemaObject | undefined): string[] =>
              [
                ...new Set([
                  ...Object.keys(schema?.properties ?? {}),
                  ...(schema?.oneOf ?? []).flatMap((branch) =>
                    fields(resolve(branch, design)),
                  ),
                ]),
              ].sort();
            if (JSON.stringify(fields(wanted)) !== JSON.stringify(fields(got)))
              discrepancies.push(`${label}: request properties differ`);
          }
        }
      }
    }
    const refs = (document: OpenAPIObject) => {
      let count = 0;
      const walk = (value: unknown): void => {
        if (!value || typeof value !== "object") return;
        if (
          "$ref" in value &&
          typeof value.$ref === "string" &&
          value.$ref.startsWith("#/")
        ) {
          count++;
          let target: unknown = document;
          for (const part of value.$ref.slice(2).split("/"))
            target = (target as Record<string, unknown> | undefined)?.[
              part.replaceAll("~1", "/").replaceAll("~0", "~")
            ];
          assert.ok(target, `Unresolved reference ${value.$ref}`);
        }
        for (const entry of Object.values(value)) walk(entry);
      };
      walk(document);
      return count;
    };
    const report = {
      milestone: "OpenAPI-3 candidate; final acceptance pending",
      paths: Object.keys(candidate.paths).length,
      operations,
      designRefs: refs(design),
      runtimeRefs: refs(candidate),
      discrepancies,
      pending,
    };
    if (write) {
      await mkdir(new URL("docs/postman/", root), { recursive: true });
      for (const [path, value] of Object.entries({
        "docs/openapi/phase-04.runtime.openapi.json": candidate,
        "docs/openapi/phase-04-contract-report.json": report,
      }))
        await writeFile(
          new URL(path, root),
          JSON.stringify(value, null, 2) + "\n",
        );
    } else {
      assert.deepEqual(
        await json("docs/openapi/phase-04.runtime.openapi.json"),
        JSON.parse(JSON.stringify(candidate)),
        "Runtime snapshot is stale; run contract:export and review the diff",
      );
      const savedReport = JSON.parse(
        await readFile(
          new URL("docs/openapi/phase-04-contract-report.json", root),
          "utf8",
        ),
      );
      assert.deepEqual(
        savedReport,
        report,
        "Contract report is stale; run contract:export",
      );
    }
    return report;
  } finally {
    await app.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = await inspectPhase4Contract(process.argv.includes("--write"));
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (
    report.discrepancies.length ||
    (process.argv.includes("--require-final") && report.pending.length)
  )
    process.exitCode = 1;
}
