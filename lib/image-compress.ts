/**
 * Client-side image preparation utilities (resize + compress) to reduce upload bandwidth and storage.
 *
 * Notes:
 * - Uses canvas re-encode to JPEG.
 * - Attempts to respect EXIF orientation via createImageBitmap(..., { imageOrientation: 'from-image' }) when supported.
 * - Iteratively lowers quality to fit within maxBytes.
 */

export type CompressToJpegOptions = {
  /** Max output file size in bytes */
  maxBytes: number;
  /** Max width/height (longer side) in pixels */
  maxDimension: number;
  /** Initial JPEG quality (0..1) */
  quality?: number;
  /** Minimum JPEG quality (0..1) */
  minQuality?: number;
  /** Base name for output file (extension will become .jpg) */
  outputBaseName?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function decodeImage(file: Blob): Promise<{ width: number; height: number; bitmap: ImageBitmap }> {
  // Prefer createImageBitmap for speed and EXIF handling.
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation option exists in modern browsers but may not be in TS libs.
      const bitmap = await (createImageBitmap as any)(file, { imageOrientation: 'from-image' });
      return { width: bitmap.width, height: bitmap.height, bitmap };
    } catch {
      const bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height, bitmap };
    }
  }

  // Fallback: HTMLImageElement decode.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to decode image'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0);
    const bitmap = await createImageBitmap(canvas);
    return { width: bitmap.width, height: bitmap.height, bitmap };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Failed to encode JPEG'));
        else resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Resize/compress an image to JPEG within constraints.
 */
export async function compressImageToJpeg(file: File, options: CompressToJpegOptions): Promise<File> {
  const {
    maxBytes,
    maxDimension,
    quality = 0.82,
    minQuality = 0.5,
    outputBaseName = 'upload',
  } = options;

  const decoded = await decodeImage(file);
  const srcW = decoded.width;
  const srcH = decoded.height;

  const longSide = Math.max(srcW, srcH);
  const scale = longSide > maxDimension ? maxDimension / longSide : 1;
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas not supported');

  // Better downscale quality in most browsers.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(decoded.bitmap, 0, 0, targetW, targetH);

  // Iteratively lower quality until within maxBytes.
  let q = clamp(quality, 0.05, 0.95);
  const minQ = clamp(minQuality, 0.05, 0.95);

  let blob = await canvasToJpegBlob(canvas, q);
  while (blob.size > maxBytes && q > minQ) {
    // Drop quality more aggressively for very large overshoots.
    const overshoot = blob.size / maxBytes;
    const step = overshoot > 2 ? 0.12 : overshoot > 1.4 ? 0.08 : 0.05;
    q = clamp(q - step, minQ, 0.95);
    blob = await canvasToJpegBlob(canvas, q);
  }

  // Name normalization (.jpg)
  const safeBase = outputBaseName.replace(/\.(jpe?g|png|webp|heic|heif)$/i, '');
  const outName = `${safeBase}.jpg`;
  return new File([blob], outName, { type: 'image/jpeg' });
}


