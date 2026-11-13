#!/usr/bin/env node
/**
 * Tải bộ font glyphs tiếng Việt (.pbf) từ Protomaps basemaps-assets
 * và upload lên Cloudflare R2 để MapLibre GL JS render nhãn mượt, 0đ (ADR-031).
 *
 * Dùng @aws-sdk/client-s3 sẵn có trong @bsc/api.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const requireFromApi = createRequire(path.join(repoRoot, 'apps', 'api', 'package.json'));
const { PutObjectCommand, S3Client } = requireFromApi('@aws-sdk/client-s3');

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
  console.error(
    'Thiếu biến môi trường R2 trong .env.local (R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET, R2_PUBLIC_URL).',
  );
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  maxAttempts: 5,
  credentials: { accessKeyId, secretAccessKey },
});

const SOURCE_BASE_URL = 'https://protomaps.github.io/basemaps-assets/fonts';
const FONT_STACKS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
const UNICODE_RANGES = ['0-255', '256-511', '512-767', '768-1023', '7680-7935', '8192-8447'];

async function uploadFontGlyph(fontStack, range) {
  const encodedStack = encodeURIComponent(fontStack);
  const sourceUrl = `${SOURCE_BASE_URL}/${encodedStack}/${range}.pbf`;
  const objectKey = `map/fonts/${fontStack}/${range}.pbf`;

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Không tải được ${sourceUrl} (HTTP ${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: 'application/x-protobuf',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  console.log(`  Uploaded r2://${bucket}/${objectKey} (${buffer.byteLength} bytes)`);
}

let uploadedCount = 0;
for (const fontStack of FONT_STACKS) {
  console.log(`Đang đồng bộ font "${fontStack}"...`);
  for (const range of UNICODE_RANGES) {
    await uploadFontGlyph(fontStack, range);
    uploadedCount++;
  }
}

const sampleCheckUrl = `${publicUrl}/map/fonts/${encodeURIComponent('Noto Sans Regular')}/0-255.pbf`;
const verifyRes = await fetch(sampleCheckUrl, {
  method: 'GET',
  headers: { Origin: 'https://booksportscourt-apps.vercel.app' },
});
console.log(`\nKiểm tra truy cập font mẫu: ${sampleCheckUrl} -> HTTP ${verifyRes.status}`);
console.log(`Access-Control-Allow-Origin: ${verifyRes.headers.get('access-control-allow-origin')}`);

if (!verifyRes.ok) {
  throw new Error(`Kiểm tra font mẫu thất bại với HTTP ${verifyRes.status}`);
}

console.log(
  `\nTHÀNH CÔNG! Đã upload ${uploadedCount} file glyph PBF.\nNEXT_PUBLIC_MAP_GLYPHS_URL=${publicUrl}/map/fonts/{fontstack}/{range}.pbf`,
);
