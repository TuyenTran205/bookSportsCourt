import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { ConfigService } from "@nestjs/config";
import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { ProofStorage } from "../src/modules/uploads/proof-storage.js";
import { decodeProof } from "../src/modules/uploads/proof-image.js";

test("R2 adapter fails closed without private bucket configuration", async () => {
  const storage = new ProofStorage(new ConfigService({ R2_BUCKET: "public" }));
  await assert.rejects(
    storage.put("proofs/test.png", Buffer.from("x")),
    (error) =>
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 503,
  );
  await assert.rejects(storage.signedGet("proofs/test.png"));
});
test("real AWS SDK signs 300-second GET and sends authenticated PUT/DELETE through local transport", async () => {
  const calls: Array<{ method: string; url: string; auth: string }> = [];
  const server = createServer((req, res) => {
    calls.push({
      method: req.method!,
      url: req.url!,
      auth: String(req.headers.authorization ?? ""),
    });
    req.resume();
    req.on("end", () => {
      res.statusCode = 200;
      res.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const storage = new ProofStorage(
    new ConfigService({
      R2_ACCOUNT_ID: "a".repeat(32),
      R2_ACCESS_KEY: "test-access-key",
      R2_SECRET_KEY: "test-secret-key",
      R2_BUCKET: "public-venue",
      R2_PROOF_BUCKET: "private-proof",
    }),
  );
  const client = new S3Client({
    endpoint: `http://127.0.0.1:${address.port}`,
    region: "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    },
    maxAttempts: 1,
  });
  (storage as unknown as { client: S3Client }).client = client;
  try {
    await storage.put("proofs/test.png", Buffer.from("test image transport"));
    const signed = await storage.signedGet("proofs/test.png");
    assert.equal(new URL(signed.url).searchParams.get("X-Amz-Expires"), "300");
    assert.ok(new URL(signed.url).searchParams.has("X-Amz-Signature"));
    assert.ok(Date.parse(signed.expiresAt) > Date.now() + 295000);
    await storage.delete("proofs/test.png");
    assert.deepEqual(
      calls.map((c) => c.method),
      ["PUT", "DELETE"],
    );
    assert.ok(
      calls.every(
        (c) =>
          c.url.startsWith("/private-proof/proofs/test.png") &&
          c.auth.startsWith("AWS4-HMAC-SHA256 "),
      ),
    );
  } finally {
    storage.onModuleDestroy();
    server.close();
    await once(server, "close");
  }
});
test("decoder checks content against MIME, strips metadata and rejects damaged/oversize input", async () => {
  for (const format of ["png", "jpeg", "webp"] as const) {
    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
    })
      [format]()
      .toBuffer();
    const decoded = await decodeProof({
      buffer: image,
      size: image.length,
      mimetype: "image/" + format,
    });
    assert.equal((await sharp(decoded).metadata()).format, "png");
    await assert.rejects(
      decodeProof({
        buffer: image,
        size: image.length,
        mimetype: "text/plain",
      }),
    );
    await assert.rejects(
      decodeProof({
        buffer: image.subarray(0, 10),
        size: 10,
        mimetype: "image/" + format,
      }),
    );
  }
  await assert.rejects(decodeProof(undefined));
  await assert.rejects(
    decodeProof({
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      size: 5 * 1024 * 1024 + 1,
      mimetype: "image/png",
    }),
  );
});
