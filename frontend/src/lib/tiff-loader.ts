import type { ImageData } from '../types';

/**
 * Extract raw pixel values from a decoded UTIF IFD.
 * Handles 8-bit, 16-bit, 32-bit integer and 32-bit float TIFFs.
 * Returns a Float64Array normalized to [0, 1].
 */
function extractChannelFromIFD(
  ifd: any,
  width: number,
  height: number,
  channelIndex: number,
  samplesPerPixel: number
): Float64Array {
  const bitsPerSample = ifd.t258?.[0] ?? 8;
  const sampleFormat = ifd.t339?.[0] ?? 1; // 1=uint, 2=int, 3=float
  const data = ifd.data;
  const numPixels = width * height;
  const ch = new Float64Array(numPixels);

  if (!data || data.length === 0) {
    return ch;
  }

  if (sampleFormat === 3 && bitsPerSample === 32) {
    // 32-bit float
    const floatView = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
    for (let i = 0; i < numPixels; i++) {
      ch[i] = floatView[i * samplesPerPixel + channelIndex];
    }
  } else if (bitsPerSample === 16) {
    // 16-bit unsigned integer
    const u16 = new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    for (let i = 0; i < numPixels; i++) {
      ch[i] = u16[i * samplesPerPixel + channelIndex];
    }
  } else if (bitsPerSample === 8) {
    // 8-bit unsigned integer
    for (let i = 0; i < numPixels; i++) {
      ch[i] = data[i * samplesPerPixel + channelIndex];
    }
  } else if (bitsPerSample === 32) {
    // 32-bit unsigned integer
    const u32 = new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4);
    for (let i = 0; i < numPixels; i++) {
      ch[i] = u32[i * samplesPerPixel + channelIndex];
    }
  } else {
    // Fallback: try reading as bytes
    for (let i = 0; i < numPixels; i++) {
      ch[i] = data[i * samplesPerPixel + channelIndex];
    }
  }

  return ch;
}

/**
 * Normalize a Float64Array to [0, 1] using min-max scaling.
 */
function normalizeChannel(ch: Float64Array): void {
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
 * Reads raw pixel data directly instead of going through toRGBA8,
 * which preserves full 16-bit dynamic range for microscopy images.
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
  const channels: Float64Array[] = [];
  const bitDepth = ifds[0].t258?.[0] ?? 8;

  if (ifds.length >= 2) {
    // Multi-page TIFF: each IFD is one channel (common for microscopy)
    for (const ifd of ifds) {
      const spp = ifd.t277?.[0] ?? 1;
      const ch = extractChannelFromIFD(ifd, ifd.width, ifd.height, 0, spp);
      normalizeChannel(ch);
      channels.push(ch);
    }
  } else {
    // Single page
    const ifd = ifds[0];
    const samplesPerPixel = ifd.t277?.[0] ?? 1;

    if (samplesPerPixel >= 2) {
      // Interleaved multi-channel in a single page
      for (let c = 0; c < samplesPerPixel; c++) {
        const ch = extractChannelFromIFD(ifd, width, height, c, samplesPerPixel);
        normalizeChannel(ch);
        channels.push(ch);
      }
    } else {
      // Single grayscale channel
      const ch = extractChannelFromIFD(ifd, width, height, 0, 1);
      normalizeChannel(ch);
      channels.push(ch);
    }
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
