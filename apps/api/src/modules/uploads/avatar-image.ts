import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import sharp from "sharp";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB đúng theo thiết kế UI/UX (CUS-15)

export interface AvatarFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export const invalidAvatarImage = () =>
  new BadRequestException({
    code: "UNSUPPORTED_FILE_TYPE",
    message: "Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG hoặc WebP.",
  });

/**
 * decodeAvatar – Chuẩn hóa ảnh đại diện người dùng:
 * - Kiểm tra dung lượng đầu vào: tối đa 2MB (khớp với thông báo giao diện).
 * - Kiểm tra chữ ký magic bytes để chống đổi đuôi file giả mạo.
 * - Tự động xoay ảnh theo EXIF orientation của camera điện thoại.
 * - Resize vuông chuẩn 512x512 pixels (fit: cover) tối ưu cho avatar hiển thị sắc nét trên cả màn hình Retina.
 * - Nén WebP chất lượng 85% (dung lượng sau nén chỉ khoảng 40KB - 120KB, tải cực nhanh và nhẹ).
 */
export async function decodeAvatar(file: AvatarFile | undefined): Promise<Buffer> {
  if (!file) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Thiếu tệp ảnh đại diện.",
    });
  }

  if (file.size > AVATAR_MAX_BYTES || file.buffer.length > AVATAR_MAX_BYTES) {
    throw new PayloadTooLargeException({
      code: "FILE_TOO_LARGE",
      message: "Dung lượng ảnh vượt quá 2MB. Vui lòng chọn ảnh nhỏ hơn.",
    });
  }

  const bytes = file.buffer;
  const signature =
    file.mimetype === "image/png"
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : file.mimetype === "image/jpeg"
        ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
        : file.mimetype === "image/webp" &&
          bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
          bytes.subarray(8, 12).toString("ascii") === "WEBP";

  if (!signature) throw invalidAvatarImage();

  try {
    const image = sharp(file.buffer, {
      failOn: "warning",
      limitInputPixels: 16_000_000,
    });

    const metadata = await image.metadata();
    const expectedMime: Record<string, string> = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

    if (
      !metadata.format ||
      !Object.hasOwn(expectedMime, metadata.format) ||
      expectedMime[metadata.format] !== file.mimetype
    ) {
      throw invalidAvatarImage();
    }

    // Resize vuông 512x512, xuất WebP chất lượng cao dung lượng cực nhẹ
    const output = await image
      .rotate()
      .resize(512, 512, { fit: "cover", position: "centre", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    if (output.length > AVATAR_MAX_BYTES) {
      throw new PayloadTooLargeException({
        code: "FILE_TOO_LARGE",
        message: "Dung lượng ảnh vượt quá 2MB. Vui lòng chọn ảnh nhỏ hơn.",
      });
    }

    return output;
  } catch (error) {
    if (error instanceof PayloadTooLargeException || error instanceof BadRequestException) {
      throw error;
    }
    throw invalidAvatarImage();
  }
}
