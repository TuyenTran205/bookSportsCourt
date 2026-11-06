import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import sharp from "sharp";
import {
  UPLOAD_MAX_BYTES,
  PROOF_MAX_PIXELS,
} from "../../../../../packages/shared/src/constants.js";
export interface ProofFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}
export const invalidImage = () =>
  new BadRequestException({
    code: "UNSUPPORTED_FILE_TYPE",
    message: "Chỉ nhận ảnh JPEG, PNG hoặc WebP hợp lệ.",
  });
export async function decodeProof(
  file: ProofFile | undefined,
): Promise<Buffer> {
  if (!file)
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Thiếu file chứng từ.",
    });
  if (file.size > UPLOAD_MAX_BYTES || file.buffer.length > UPLOAD_MAX_BYTES)
    throw new PayloadTooLargeException({
      code: "FILE_TOO_LARGE",
      message: "Ảnh tối đa 5 MiB.",
    });
  try {
    // Select only supported codecs before handing untrusted bytes to the decoder.
    const bytes = file.buffer;
    const signature =
      file.mimetype === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : file.mimetype === "image/jpeg"
          ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
          : file.mimetype === "image/webp" &&
            bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
            bytes.subarray(8, 12).toString("ascii") === "WEBP";
    if (!signature) throw invalidImage();
    const image = sharp(file.buffer, {
      failOn: "warning",
      limitInputPixels: PROOF_MAX_PIXELS,
    });
    const metadata = await image.metadata();
    const expected = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    if (
      !(metadata.format && Object.hasOwn(expected, metadata.format)) ||
      expected[metadata.format as keyof typeof expected] !== file.mimetype
    )
      throw invalidImage();
    const output = await image.rotate().png().toBuffer();
    if (output.length > UPLOAD_MAX_BYTES)
      throw new PayloadTooLargeException({
        code: "FILE_TOO_LARGE",
        message: "Ảnh sau chuẩn hoá vượt 5 MiB.",
      });
    return output;
  } catch (error) {
    if (error instanceof PayloadTooLargeException) throw error;
    throw invalidImage();
  }
}
