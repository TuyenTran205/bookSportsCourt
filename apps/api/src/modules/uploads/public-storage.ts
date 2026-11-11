import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

@Injectable()
export class PublicStorage {
  private readonly logger = new Logger(PublicStorage.name);
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  private getR2Config() {
    const accountId = this.config.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.config.get<string>("R2_ACCESS_KEY");
    const secretAccessKey = this.config.get<string>("R2_SECRET_KEY");
    const bucket = this.config.get<string>("R2_BUCKET");
    const publicUrl = this.config.get<string>("R2_PUBLIC_URL");

    if (accountId && accessKeyId && secretAccessKey && bucket) {
      this.client ??= new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        maxAttempts: 2,
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      });
      const resolvedPublicUrl = (
        publicUrl || `https://${accountId}.r2.cloudflarestorage.com`
      ).trim().replace(/\/+$/, "");
      return { client: this.client, bucket, publicUrl: resolvedPublicUrl };
    }
    return null;
  }

  /**
   * Lưu ảnh đại diện:
   * - Nếu cấu hình Cloudflare R2: Đẩy trực tiếp lên R2 Bucket và trả về Public URL CDN.
   * - Nếu chưa có cấu hình: Tự động lưu fallback vào thư mục static `apps/web/public/uploads/avatars`.
   */
  async saveAvatar(userId: string, buffer: Buffer, mimeType: string = "image/webp"): Promise<string> {
    const ext = mimeType.split("/")[1] || "webp";
    const filename = `avatar-${userId}-${Date.now()}.${ext}`;
    const r2 = this.getR2Config();

    if (r2) {
      const key = `avatars/${filename}`;
      try {
        await r2.client.send(
          new PutObjectCommand({
            Bucket: r2.bucket,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
            CacheControl: "public, max-age=31536000, immutable",
          }),
        );
        this.logger.log(`Đã tải ảnh đại diện lên Cloudflare R2: ${key}`);
        return `${r2.publicUrl}/${key}`;
      } catch (err) {
        this.logger.error("Không thể tải lên Cloudflare R2, chuyển sang lưu tạm thư mục local:", err);
      }
    }

    if (this.config.get<string>("NODE_ENV") === "production") {
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    }

    // Fallback lưu local khi chạy dev: apps/web/public/uploads/avatars
    try {
      const uploadDir = fileURLToPath(
        new URL("../../../../web/public/uploads/avatars", import.meta.url),
      );
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), buffer);
      return `/uploads/avatars/${filename}`;
    } catch {
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    }
  }

  /**
   * Lưu ảnh cơ sở thể thao (Venue image):
   * - Tối ưu hóa ảnh với sharp: resize max 1920x1080 (fit inside, withoutEnlargement), WebP 85%.
   * - Nếu cấu hình Cloudflare R2: Đẩy trực tiếp lên R2 Bucket với prefix `venues/` và trả về Public URL CDN.
   * - Nếu chưa có cấu hình hoặc lỗi: Lưu fallback vào thư mục static `apps/web/public/uploads/venues`.
   */
  async saveVenueImage(venueId: string, buffer: Buffer, mimeType: string = "image/webp"): Promise<string> {
    let processedBuffer = buffer;
    let finalMime = mimeType;
    let ext = mimeType.split("/")[1] || "webp";

    try {
      processedBuffer = await sharp(buffer)
        .resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      finalMime = "image/webp";
      ext = "webp";
    } catch {
      // nếu sharp không convert được (SVG hoặc lỗi codec), giữ nguyên
    }

    const filename = `venue-${venueId}-${Date.now()}.${ext}`;
    const r2 = this.getR2Config();

    if (r2) {
      const key = `venues/${filename}`;
      try {
        await r2.client.send(
          new PutObjectCommand({
            Bucket: r2.bucket,
            Key: key,
            Body: processedBuffer,
            ContentType: finalMime,
            CacheControl: "public, max-age=31536000, immutable",
          }),
        );
        this.logger.log(`Đã tải ảnh cơ sở lên Cloudflare R2: ${key}`);
        return `${r2.publicUrl}/${key}`;
      } catch (err) {
        this.logger.error("Không thể tải ảnh cơ sở lên Cloudflare R2, chuyển sang lưu tạm thư mục local:", err);
      }
    }

    if (this.config.get<string>("NODE_ENV") === "production") {
      return `data:${finalMime};base64,${processedBuffer.toString("base64")}`;
    }

    // Fallback lưu local khi chạy dev: apps/web/public/uploads/venues
    try {
      const uploadDir = fileURLToPath(
        new URL("../../../../web/public/uploads/venues", import.meta.url),
      );
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), processedBuffer);
      return `/uploads/venues/${filename}`;
    } catch {
      return `data:${finalMime};base64,${processedBuffer.toString("base64")}`;
    }
  }
}
