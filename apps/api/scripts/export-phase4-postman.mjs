import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../../../", import.meta.url);
const read = async (name) =>
  JSON.parse(await readFile(new URL(name, root), "utf8"));
const design = await read("docs/openapi/phase-04.openapi.json");
const runtime = await read("docs/openapi/phase-04.runtime.openapi.json");
const methods = ["get", "post", "put", "patch", "delete"];
const deref = (schema) =>
  schema?.$ref
    ? design.components.schemas[schema.$ref.split("/").at(-1)]
    : schema;
const variable = (name) => `{{${name}}}`;
const samples = {
  email: variable("testEmail"),
  token: variable("resetToken"),
  password: variable("newPassword"),
  confirmPassword: variable("newPassword"),
  bookingId: variable("completedBookingId"),
  rating: 5,
  status: "approved",
  reviewNote: "Ho so hop le",
  reason: "Chung tu khong hop le",
  businessName: "Co so the thao test",
  phone: "0901234567",
  address: "123 Duong Test, Thanh pho Ho Chi Minh",
  bankBin: "970436",
  accountNo: "1234567890",
  accountName: "FIXTURE OWNER",
  isVisible: false,
};
function example(schema) {
  schema = deref(schema);
  if (!schema) return {};
  if (schema.oneOf) return example(schema.oneOf[0]);
  return Object.fromEntries(
    (schema.required ?? []).map((key) => [
      key,
      samples[key] ?? schema.properties?.[key]?.enum?.[0] ?? "Test value",
    ]),
  );
}
const tests = (status) => [
  {
    listen: "test",
    script: {
      type: "text/javascript",
      exec: [
        `pm.test('HTTP ${status}', function () { pm.response.to.have.status(${status}); });`,
        "if (pm.response.code === 204) { pm.test('204 empty', function () { pm.expect(pm.response.text()).to.eql(''); }); }",
        "else if (pm.response.headers.get('Content-Type')?.includes('application/json')) { const body = pm.response.json(); pm.test('Envelope', function () { pm.expect(body).to.have.property(pm.response.code >= 400 ? 'error' : 'data'); }); }",
      ],
    },
  },
];
const request = (name, method, path, status, body, guest = false) => ({
  name,
  event: tests(status),
  request: {
    method,
    header: [{ key: "X-Request-Origin", value: "{{frontendOrigin}}" }],
    url: "{{baseUrl}}" + path,
    ...(body ? { body } : {}),
    description:
      "Manual request only. Select the correct account/cookie jar and disposable resource IDs. Do not run all mutations as one collection flow.",
  },
  protocolProfileBehavior: {
    followRedirects: false,
    ...(guest ? { disableCookies: true } : {}),
  },
});
const login = (role) =>
  request(`Login ${role} (cookie jar)`, "POST", "/auth/login", 200, {
    mode: "raw",
    raw: JSON.stringify(
      {
        email: variable(role + "Email"),
        password: variable(role + "Password"),
      },
      null,
      2,
    ),
    options: { raw: { language: "json" } },
  });
const groups = new Map();
let count = 0;
for (const [path, item] of Object.entries(design.paths)) {
  if (!runtime.paths["/api/v1" + path]) continue;
  for (const method of methods) {
    const operation = item[method];
    if (!operation) continue;
    const role = operation["x-required-role"] ?? "public";
    if (!groups.has(role)) groups.set(role, []);
    const resource = path.includes("owner/payments")
      ? "paymentId"
      : path.includes("owner-applications/")
        ? "applicationId"
        : path.includes("reviews/")
          ? "reviewId"
          : path.includes("users/")
            ? "targetUserId"
            : path.includes("venues/")
              ? "venueId"
              : "bookingId";
    let url = path.replace(/\{id\}/g, variable(resource));
    const queries = (operation.parameters ?? [])
      .filter((p) => p.in === "query" && p.required)
      .map((p) => `${p.name}=${variable(p.name)}`);
    if (path === "/auth/google/callback") queries.push("code={{code}}");
    if (queries.length) url += "?" + queries.join("&");
    const content = operation.requestBody?.content;
    const jsonSchema = content?.["application/json"]?.schema;
    let body;
    if (jsonSchema)
      body = {
        mode: "raw",
        raw: JSON.stringify(
          path === "/users/{id}/status"
            ? { status: "suspended" }
            : example(jsonSchema),
          null,
          2,
        ),
        options: { raw: { language: "json" } },
      };
    if (content?.["multipart/form-data"])
      body = {
        mode: "formdata",
        formdata: [{ key: "file", type: "file", src: "" }],
      };
    const success = Object.keys(operation.responses).find((code) =>
      /^[23]/.test(code),
    );
    groups
      .get(role)
      .push(
        request(
          `${method.toUpperCase()} ${path}`,
          method.toUpperCase(),
          url,
          Number(success),
          body,
        ),
      );
    count++;
  }
}
const collection = {
  info: {
    name: "BookSportsCourt Phase 4 - manual acceptance",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    description:
      "Runtime-backed candidate, not final Phase 4 acceptance. No secrets. Manual requests, not an executable lifecycle. Refund route is deliberately absent because runtime has no implementation. See docs/phase-04-step-15-acceptance-and-openapi.md.",
  },
  item: [
    {
      name: "00 - Login (choose one account)",
      item: [login("customer"), login("owner"), login("admin")],
    },
    ...[...groups].map(([name, item]) => ({ name, item })),
    {
      name: "Negative - guest and validation",
      item: [
        request(
          "Guest Owner list -> 401",
          "GET",
          "/owner/payments",
          401,
          undefined,
          true,
        ),
        request(
          "Guest Admin booking -> 401",
          "GET",
          "/admin/bookings",
          401,
          undefined,
          true,
        ),
        request(
          "Guest Admin reviews -> 401",
          "GET",
          "/admin/reviews",
          401,
          undefined,
          true,
        ),
        request(
          "Invalid public venue UUID -> 400",
          "GET",
          "/venues/not-a-uuid/reviews",
          400,
          undefined,
          true,
        ),
        request(
          "Forgot invalid email -> 400",
          "POST",
          "/auth/forgot-password",
          400,
          {
            mode: "raw",
            raw: '{"email":"not-an-email"}',
            options: { raw: { language: "json" } },
          },
          true,
        ),
      ],
    },
  ],
};
const names = [
  "customerEmail",
  "customerPassword",
  "ownerEmail",
  "ownerPassword",
  "adminEmail",
  "adminPassword",
  "testEmail",
  "newPassword",
  "resetToken",
  "bookingId",
  "completedBookingId",
  "paymentId",
  "applicationId",
  "venueId",
  "reviewId",
  "targetUserId",
  "state",
  "code",
];
const environment = {
  name: "BookSportsCourt Phase 4 local - no secrets",
  values: [
    { key: "baseUrl", value: "http://localhost:3001/api/v1", enabled: true },
    { key: "frontendOrigin", value: "http://localhost:3000", enabled: true },
    ...names.map((key) => ({
      key,
      value: "",
      enabled: true,
      ...(key.toLowerCase().includes("password") || key.includes("Token")
        ? { type: "secret" }
        : {}),
    })),
  ],
  _postman_variable_scope: "environment",
};
await mkdir(new URL("docs/postman/", root), { recursive: true });
await writeFile(
  new URL("docs/postman/phase-04.postman_collection.json", root),
  JSON.stringify(collection, null, 2) + "\n",
);
await writeFile(
  new URL("docs/postman/phase-04.local.postman_environment.json", root),
  JSON.stringify(environment, null, 2) + "\n",
);
process.stdout.write(
  `Generated ${count} runtime operations, 3 login helpers and 5 negative requests; no account secrets.\n`,
);
