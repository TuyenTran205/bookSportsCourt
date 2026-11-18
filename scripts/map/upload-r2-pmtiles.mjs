#!/usr/bin/env node
/**
 * Upload file vietnam.pmtiles lên Cloudflare R2 bằng S3 Multipart Upload
 * và cấu hình CORS hỗ trợ HTTP Range Request (ADR-030).
 *
 * Dùng @aws-sdk/client-s3 sẵn có trong @bsc/api.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const requireFromApi = createRequire(path.join(repoRoot, 'apps', 'api', 'package.json'));
const {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} = requireFromApi('@aws-sdk/client-s3');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(repoRoot, '.env.local'));
loadEnvFile(path.join(repoRoot, '.env'));

const accountId = process.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY?.trim();
const secretAccessKey = process.env.R2_SECRET_KEY?.trim();
const bucket = process.env.R2_BUCKET?.trim();
const publicUrl = process.env.R2_PUBLIC_URL?.trim()?.replace(/\/+$/, '');

if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
  console.error('Thiếu biến môi trường R2 trong .env.local (R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET, R2_PUBLIC_URL).');
  process.exit(1);
}

const inputFile = path.resolve(repoRoot, process.argv[2] ?? '.tmp/vietnam.pmtiles');
const objectKey = process.argv[3] ?? 'map/vietnam.pmtiles';

if (!fs.existsSync(inputFile)) {
  console.error(`Không tìm thấy file PMTiles tại: ${inputFile}`);
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  maxAttempts: 5,
  credentials: { accessKeyId, secretAccessKey },
});

async function withRetry(label, fn, maxRetries = 5) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;
      const delayMs = attempt * 2000;
      console.warn(`  [Retry ${attempt}/${maxRetries}] ${label} lỗi tạm thời (${err?.code ?? err?.message}), thử lại sau ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function ensureCorsPolicy() {
  const desiredCorsPath = path.join(repoRoot, 'scripts', 'map', 'r2-cors.json');
  const desiredRulesRaw = JSON.parse(fs.readFileSync(desiredCorsPath, 'utf8'));

  let existingRules = [];
  try {
    const existing = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
    existingRules = existing.CORSRules ?? [];
  } catch (err) {
    if (err?.name === 'AccessDenied' || err?.$metadata?.httpStatusCode === 403) {
      console.warn(
        'Lưu ý: R2 API Token không có quyền đọc/sửa Bucket CORS (AccessDenied). Sẽ tiếp tục upload file và kiểm tra header CORS qua HTTP.',
      );
      return false;
    }
    if (err?.name !== 'NoSuchCORSConfiguration') {
      throw err;
    }
  }

  const desiredOrigins = Array.from(
    new Set([
      ...existingRules.flatMap((rule) => rule.AllowedOrigins ?? []),
      ...desiredRulesRaw.flatMap((rule) => rule.AllowedOrigins ?? []),
    ]),
  );

  const desiredRule = {
    AllowedOrigins: desiredOrigins,
    AllowedMethods: Array.from(
      new Set([
        ...existingRules.flatMap((rule) => rule.AllowedMethods ?? []),
        'GET',
        'HEAD',
      ]),
    ),
    AllowedHeaders: Array.from(
      new Set([
        ...existingRules.flatMap((rule) => rule.AllowedHeaders ?? []),
        'Range',
        'If-None-Match',
        'If-Modified-Since',
      ]),
    ),
    ExposeHeaders: Array.from(
      new Set([
        ...existingRules.flatMap((rule) => rule.ExposeHeaders ?? []),
        'ETag',
        'Content-Length',
        'Content-Range',
        'Accept-Ranges',
      ]),
    ),
    MaxAgeSeconds: 86400,
  };

  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: { CORSRules: [desiredRule] },
      }),
    );
    console.log('Đã cập nhật CORS Policy trên R2 bucket (hỗ trợ HTTP Range).');
    return true;
  } catch (err) {
    if (err?.name === 'AccessDenied' || err?.$metadata?.httpStatusCode === 403) {
      console.warn(
        'Lưu ý: R2 API Token chỉ có quyền Object Read & Write (không có quyền sửa Bucket CORS). Sẽ kiểm tra CORS hiện tại sau khi upload.',
      );
      return false;
    }
    throw err;
  }
}

async function uploadFile() {
  const stats = fs.statSync(inputFile);
  const totalBytes = stats.size;
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`Bắt đầu upload ${path.basename(inputFile)} (${totalMb} MB) -> r2://${bucket}/${objectKey}`);

  const commonParams = {
    Bucket: bucket,
    Key: objectKey,
    ContentType: 'application/vnd.pmtiles',
    CacheControl: 'public, max-age=2592000',
  };

  // File nhỏ hơn 20 MB dùng PutObject một lần
  if (totalBytes <= 20 * 1024 * 1024) {
    const body = fs.readFileSync(inputFile);
    await s3.send(new PutObjectCommand({ ...commonParams, Body: body }));
    return;
  }

  // File lớn dùng Multipart Upload 8 MB mỗi part kèm retry tự động
  const partSize = 8 * 1024 * 1024;
  const created = await withRetry('CreateMultipartUpload', () =>
    s3.send(new CreateMultipartUploadCommand(commonParams)),
  );
  const uploadId = created.UploadId;
  if (!uploadId) {
    throw new Error('Không lấy được UploadId từ R2.');
  }

  const fd = fs.openSync(inputFile, 'r');
  const completedParts = [];
  try {
    const partCount = Math.ceil(totalBytes / partSize);
    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const start = (partNumber - 1) * partSize;
      const length = Math.min(partSize, totalBytes - start);
      const buffer = Buffer.allocUnsafe(length);
      fs.readSync(fd, buffer, 0, length, start);

      const res = await withRetry(`UploadPart ${partNumber}/${partCount}`, () =>
        s3.send(
          new UploadPartCommand({
            Bucket: bucket,
            Key: objectKey,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: buffer,
          }),
        ),
      );

      completedParts.push({ PartNumber: partNumber, ETag: res.ETag });
      console.log(`  Part ${partNumber}/${partCount} hoàn tất (${Math.round((partNumber / partCount) * 100)}%)`);
    }

    await withRetry('CompleteMultipartUpload', () =>
      s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: objectKey,
          UploadId: uploadId,
          MultipartUpload: { Parts: completedParts },
        }),
      ),
    );
  } catch (err) {
    await s3.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        UploadId: uploadId,
      }),
    ).catch(() => {});
    throw err;
  } finally {
    fs.closeSync(fd);
  }
}

async function verifyRangeAccess(targetUrl) {
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      Range: 'bytes=0-127',
      Origin: 'https://booksportscourt-apps.vercel.app',
    },
  });

  const acceptRanges = response.headers.get('accept-ranges');
  const contentRange = response.headers.get('content-range');
  const allowOrigin = response.headers.get('access-control-allow-origin');
  console.log(`Verify URL: ${targetUrl}`);
  console.log(`  HTTP Status: ${response.status}`);
  console.log(`  Accept-Ranges: ${acceptRanges}`);
  console.log(`  Content-Range: ${contentRange}`);
  console.log(`  Access-Control-Allow-Origin: ${allowOrigin}`);

  if (response.status !== 206) {
    throw new Error(`Kỳ vọng HTTP 206 Partial Content nhưng nhận được ${response.status}`);
  }
  if (!allowOrigin) {
    console.warn(
      '\nCẢNH BÁO CORS: R2 chưa trả header Access-Control-Allow-Origin cho trình duyệt.\nHãy mở Cloudflare Dashboard -> R2 -> Bucket booksportscourt -> Settings -> CORS Policy và dán nội dung file scripts/map/r2-cors.json!',
    );
  }
}

await ensureCorsPolicy();
await uploadFile();
const targetUrl = `${publicUrl}/${objectKey}`;
await verifyRangeAccess(targetUrl);
console.log(`\nTHÀNH CÔNG! Đặt biến môi trường:\nNEXT_PUBLIC_VIETNAM_PMTILES_URL=${targetUrl}`);
