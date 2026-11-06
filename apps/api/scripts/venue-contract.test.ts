import "reflect-metadata";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  ApiBody,
  ApiResponse,
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";
import {
  createVenueSchema,
  updateVenueSchema,
  adminVenueQuerySchema,
} from "../../../packages/shared/src/schemas.js";
import { ZodValidationPipe } from "../src/common/pipes/zod-validation.pipe.js";
import { TransformResponseInterceptor } from "../src/common/interceptors/transform-response.interceptor.js";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter.js";
import {
  ApiVenueQuery,
  publicVenueResponseOpenApi,
  createVenueOpenApi,
  updateVenueOpenApi,
  venueStatusOpenApi,
  privateVenueOpenApi,
  adminVenueQueryOpenApi,
  ownerVenueQueryOpenApi,
} from "../src/modules/venues/dto/venue.swagger.js";
import type {
  CreateVenueDto,
  UpdateVenueDto,
  AdminVenueQueryDto,
} from "../src/modules/venues/dto/venue.dto.js";
import type { ApiErrorBody } from "../../../packages/shared/src/types.js";
import {
  privateVenueResponseOpenApi,
  privateVenueListResponseOpenApi,
} from "../src/modules/venues/dto/venue.swagger.js";

// No database, business logic or authorization claims: tests HTTP contracts only.
@Controller("probe")
class VenueContractProbe {
  @Post()
  @ApiBody({ schema: createVenueOpenApi })
  @ApiResponse({ status: 201, schema: privateVenueResponseOpenApi })
  create(@Body(new ZodValidationPipe(createVenueSchema)) body: CreateVenueDto) {
    return body;
  }

  @Patch()
  @ApiBody({ schema: updateVenueOpenApi })
  update(@Body(new ZodValidationPipe(updateVenueSchema)) body: UpdateVenueDto) {
    return body;
  }

  @Get()
  @ApiVenueQuery("admin")
  list(
    @Query(new ZodValidationPipe(adminVenueQuerySchema))
    query: AdminVenueQueryDto,
  ) {
    return {
      data: [],
      meta: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
    };
  }

  @Delete()
  @HttpCode(204)
  remove(): void {}
}

const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(5000) });

const input = {
  name: "  Sân A  ",
  address: "123 Đường A",
  provinceId: "019a0000-0014-7000-8000-000000000011",
  districtId: "019a0000-0014-7000-8000-000000000012",
  lat: 10,
  lng: 106,
};

test("Nest pipes and existing envelope/filter preserve HTTP 201/200/204 and validation errors", async () => {
  const module = await Test.createTestingModule({
    controllers: [VenueContractProbe],
  }).compile();
  const app = module.createNestApplication({ logger: ["error"] });
  try {
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.listen(0, "127.0.0.1");
    const base = `${await app.getUrl()}/probe`;
    const created = await fetchWithTimeout(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), {
      data: { ...input, name: "Sân A", sportIds: [], amenityIds: [] },
    });
    const patch = await fetchWithTimeout(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Mới" }),
    });
    assert.equal(patch.status, 200);
    assert.deepEqual(await patch.json(), { data: { description: "Mới" } });
    const list = await fetchWithTimeout(`${base}?page=2&limit=10`);
    assert.deepEqual(await list.json(), {
      data: [],
      meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
    });
    for (const url of [
      `${base}?page=`,
      `${base}?page=1&page=2`,
      `${base}?ownerId=forged`,
    ]) {
      const invalid = await fetchWithTimeout(url);
      assert.equal(invalid.status, 400);
      const result = (await invalid.json()) as ApiErrorBody;
      assert.equal(result.error.code, "VALIDATION_ERROR");
      assert.equal(result.error.httpStatus, 400);
      assert.ok(result.error.details);
    }
    const forbiddenField = await fetchWithTimeout(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, ownerId: "forged" }),
    });
    assert.equal(forbiddenField.status, 400);
    const deleted = await fetchWithTimeout(base, { method: "DELETE" });
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), "");
  } finally {
    await app.close();
  }
});

function withoutDescriptions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutDescriptions);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, child]) => key !== "description" || typeof child !== "string",
        )
        .map(([key, child]) => [key, withoutDescriptions(child)]),
    );
  return value;
}

test("Swagger metadata agrees with the checked-in OpenAPI request and private response schemas", async () => {
  const spec = JSON.parse(
    await readFile(
      new URL("../../../docs/openapi/bsc-014.openapi.json", import.meta.url),
      "utf8",
    ),
  ) as OpenAPIObject;
  const schemas = spec.components?.schemas;
  assert.ok(schemas);
  const resolve = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === "object") {
      if ("$ref" in value && typeof value.$ref === "string")
        return resolve(schemas[value.$ref.split("/").at(-1)!]);
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, resolve(child)]),
      );
    }
    return value;
  };
  for (const [path, method, code, actual] of [
    ["/venues", "post", "201", privateVenueResponseOpenApi],
    ["/venues/{id}", "patch", "200", privateVenueResponseOpenApi],
    ["/venues/{id}/status", "patch", "200", privateVenueResponseOpenApi],
    ["/owner/venues", "get", "200", privateVenueListResponseOpenApi],
    ["/admin/venues", "get", "200", privateVenueListResponseOpenApi],
    ["/venues/{slug}", "get", "200", publicVenueResponseOpenApi],
  ] as const) {
    const response = spec.paths[path]?.[method]?.responses[code];
    assert.ok(response && "content" in response);
    assert.deepEqual(
      withoutDescriptions(
        resolve(response.content?.["application/json"]?.schema),
      ),
      withoutDescriptions(actual),
    );
  }
  for (const [name, actual] of Object.entries({
    CreateVenue: createVenueOpenApi,
    UpdateVenue: updateVenueOpenApi,
    VenueStatusUpdate: venueStatusOpenApi,
    OwnerVenueResponse: privateVenueOpenApi,
    AdminVenueResponse: privateVenueOpenApi,
  })) {
    assert.deepEqual(
      withoutDescriptions(actual),
      withoutDescriptions(schemas[name]),
      name,
    );
  }
  for (const [path, fields] of Object.entries({
    "/owner/venues": ownerVenueQueryOpenApi,
    "/admin/venues": adminVenueQueryOpenApi,
  })) {
    const expected = Object.entries(fields).map(([name, schema]) => ({
      name,
      in: "query",
      schema,
    }));
    assert.deepEqual(
      withoutDescriptions(spec.paths[path]?.get?.parameters),
      expected,
    );
  }
  const module = await Test.createTestingModule({
    controllers: [VenueContractProbe],
  }).compile();
  const app = module.createNestApplication({ logger: ["error"] });
  try {
    await app.init();
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("Contract probe").setVersion("1").build(),
    );
    assert.deepEqual(
      withoutDescriptions(doc.paths["/probe"]?.post?.requestBody),
      {
        required: true,
        content: { "application/json": { schema: createVenueOpenApi } },
      },
    );
    assert.equal(doc.paths["/probe"]?.get?.parameters?.length, 4);
  } finally {
    await app.close();
  }
});
