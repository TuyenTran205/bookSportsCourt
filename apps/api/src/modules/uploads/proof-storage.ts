import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PROOF_URL_TTL_SECONDS } from "../../../../../packages/shared/src/constants.js";

@Injectable()
export class ProofStorage implements OnModuleDestroy {
  private client?: S3Client;
  constructor(private readonly config: ConfigService) {}
  private isLocalDriver(): boolean {
    return (
      this.config.get<string>("NODE_ENV") !== "production" &&
      this.config.get<string>("PROOF_STORAGE_DRIVER") === "local"
    );
  }
  private localPath(key: string): string {
    const safeKey = key.replace(/^\/+/, "").replace(/\.\./g, "_");
    return path.join(tmpdir(), "bsc-local-proofs", safeKey);
  }
  private settings() {
    const accountId = this.config.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.config.get<string>("R2_ACCESS_KEY");
    const secretAccessKey = this.config.get<string>("R2_SECRET_KEY");
    const bucket =
      this.config.get<string>("R2_PROOF_BUCKET") ||
      this.config.get<string>("R2_BUCKET");
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket)
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Storage chứng từ private chưa sẵn sàng.",
      });
    this.client ??= new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 2,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    return { client: this.client, bucket };
  }
  async put(key: string, buffer: Buffer) {
    if (this.isLocalDriver()) {
      const target = this.localPath(key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, buffer);
      return;
    }
    try {
      const { client, bucket } = this.settings();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: "image/png",
          CacheControl: "private, no-store",
        }),
        { abortSignal: AbortSignal.timeout(10000) },
      );
    } catch {
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Không thể lưu chứng từ.",
      });
    }
  }
  async signedGet(key: string) {
    if (this.isLocalDriver()) {
      let url = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
      try {
        const bytes = await readFile(this.localPath(key));
        url = `data:image/png;base64,${bytes.toString("base64")}`;
      } catch {
        // Giữ ảnh 1x1 fallback nếu file tạm chưa có trên đĩa (VD row seed cũ)
      }
      return {
        url,
        expiresAt: new Date(
          Date.now() + PROOF_URL_TTL_SECONDS * 1000,
        ).toISOString(),
      };
    }
    try {
      const { client, bucket } = this.settings();
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseCacheControl: "private, no-store",
          ResponseContentType: "image/png",
        }),
        { expiresIn: PROOF_URL_TTL_SECONDS },
      );
      return {
        url,
        expiresAt: new Date(
          Date.now() + PROOF_URL_TTL_SECONDS * 1000,
        ).toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Không thể cấp quyền xem chứng từ.",
      });
    }
  }
  async delete(key: string) {
    if (this.isLocalDriver()) {
      await rm(this.localPath(key), { force: true });
      return;
    }
    const { client, bucket } = this.settings();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
      abortSignal: AbortSignal.timeout(10000),
    });
  }
  onModuleDestroy() {
    this.client?.destroy();
  }
}
