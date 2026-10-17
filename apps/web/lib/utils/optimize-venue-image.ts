const MAX_IMAGE_DIMENSION = 1440;
const MAX_OPTIMIZED_SIZE = 1_200_000;

export async function optimizeVenueImage(file: File): Promise<File> {
  const image = await createImageBitmap(file);

  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
    let width = Math.max(1, Math.round(image.width * scale));
    let height = Math.max(1, Math.round(image.height * scale));
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Không thể xử lý ảnh trên trình duyệt này.');
      context.drawImage(image, 0, 0, width, height);

      for (const quality of [0.82, 0.68, 0.54]) {
        blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/webp', quality);
        });
        if (!blob) throw new Error('Không thể xử lý ảnh đã chọn.');
        if (blob.size <= MAX_OPTIMIZED_SIZE) break;
      }

      if (blob && blob.size <= MAX_OPTIMIZED_SIZE) break;
      width = Math.max(320, Math.round(width * 0.75));
      height = Math.max(320, Math.round(height * 0.75));
    }

    if (!blob || blob.size > MAX_OPTIMIZED_SIZE) {
      throw new Error('Ảnh quá phức tạp để tải lên. Vui lòng chọn ảnh khác.');
    }
    if (blob.type !== 'image/webp') {
      throw new Error('Trình duyệt không hỗ trợ xử lý ảnh WebP.');
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'venue-cover';
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
  } finally {
    image.close();
  }
}
