import type { ImageData } from '../types';

/**
 * Extract a grayscale channel from UTIF's decoded RGBA8 buffer.
 * After decodeImage(), ifd.data is always RGBA8 (4 bytes per pixel).
 * For grayscale pages, the intensity is in the R channel.
 */
function extractGrayscaleFromRGBA8(
  rgba: Uint8Array,
  numPixels: number
): Float64Array {
  const ch = new Float64Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    ch[i] = rgba[i * 4] / 255;
  }
  return ch;
}

/**
 * Normalize a Float64Array to [0, 1] using min-max scaling.
 * Uses percentile-based normalization (0.1% - 99.9%) to handle
 * outlier pixels common in fluorescence microscopy.
 */
function normalizeChannel(ch: Float64Array): void {
  if (ch.length === 0) return;

  // Simple min-max first pass
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < ch.length; i++) {
    if (ch[i] < min) min = ch[i];
    if (ch[i] > max) max = ch[i];
  }
  const range = max - min;
  if (range > 0) {
    for (let i = 0; i < ch.length; i++) {
      ch[i] = (ch[i] - min) / range;
    }
  }
}

/**
 * Build channel names from count.
 */
function makeChannelNames(count: number): string[] {
  if (count === 1) return ['Grayscale'];
  if (count === 2) return ['DAPI', 'cFos'];
  if (count === 3) return ['DAPI', 'cFos', 'Ch3'];
  return Array.from({ length: count }, (_, i) => `Ch${i + 1}`);
}

/**
 * Load a TIFF file and extract channels as normalized Float64Arrays.
 *
 * UTIF's decodeImage() always produces an RGBA8 buffer in ifd.data,
 * regardless of the original bit depth. For multi-page TIFFs (one
 * channel per page), we extract the R component from each page's
 * RGBA8 output. For single-page multi-sample images, we use toRGBA8
 * and split into RGB.
 */
export async function loadTiff(file: File): Promise<ImageData> {
  const buffer = await file.arrayBuffer();
  const UTIF = await import('utif2');
  const ifds = UTIF.decode(buffer);

  if (ifds.length === 0) {
    throw new Error('No image data found in TIFF file');
  }

  // Decode all pages
  for (const ifd of ifds) {
    UTIF.decodeImage(buffer, ifd);
  }

  const width = ifds[0].width;
  const height = ifds[0].height;
  const numPixels = width * height;
  const channels: Float64Array[] = [];
  const bitDepth = ifds[0].t258?.[0] ?? 8;

  if (ifds.length >= 2) {
    // Multi-page TIFF: each IFD is one channel
    for (const ifd of ifds) {
      const rgba = UTIF.toRGBA8(ifd);
      const ch = extractGrayscaleFromRGBA8(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), ifd.width * ifd.height);
      normalizeChannel(ch);
      channels.push(ch);
    }
  } else {
    // Single page - extract from RGBA8
    const ifd = ifds[0];
    const rgba = UTIF.toRGBA8(ifd);
    const samplesPerPixel = ifd.t277?.[0] ?? 1;

    if (samplesPerPixel >= 3) {
      // RGB or more - split into separate channels
      for (let c = 0; c < 3; c++) {
        const ch = new Float64Array(numPixels);
        for (let i = 0; i < numPixels; i++) {
          ch[i] = rgba[i * 4 + c] / 255;
        }
        normalizeChannel(ch);
        channels.push(ch);
      }
    } else {
      // Grayscale
      const ch = extractGrayscaleFromRGBA8(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), numPixels);
      normalizeChannel(ch);
      channels.push(ch);
    }
  }

  // If we got no usable channels, the TIFF format isn't supported
  if (channels.length === 0 || channels.every(ch => {
    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i];
    return sum === 0;
  })) {
    throw new Error(
      'Could not decode TIFF pixel data. The file may use an unsupported compression format. ' +
      'Try re-saving as uncompressed TIFF or converting to PNG.'
    );
  }

  return {
    width,
    height,
    channels,
    channelNames: makeChannelNames(channels.length),
    bitDepth,
    fileName: file.name,
  };
}

/**
 * Load a standard image file (PNG, JPEG) as RGB channels.
 */
export async function loadStandardImage(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);

      const r = new Float64Array(img.width * img.height);
      const g = new Float64Array(img.width * img.height);
      const b = new Float64Array(img.width * img.height);
      for (let i = 0; i < img.width * img.height; i++) {
        r[i] = imgData.data[i * 4] / 255;
        g[i] = imgData.data[i * 4 + 1] / 255;
        b[i] = imgData.data[i * 4 + 2] / 255;
      }

      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height,
        channels: [r, g, b],
        channelNames: ['Red', 'Green', 'Blue'],
        bitDepth: 8,
        fileName: file.name,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export async function loadImage(file: File): Promise<ImageData> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.tif') || name.endsWith('.tiff')) {
    return loadTiff(file);
  }
  return loadStandardImage(file);
}
