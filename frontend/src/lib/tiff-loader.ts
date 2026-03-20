import type { ImageData } from '../types';

/**
 * Load a TIFF file and extract channels as normalized Float64Arrays.
 * Handles 8-bit, 16-bit, and 32-bit TIFFs with multiple pages (channels).
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

  // Determine if multi-page (each page = channel) or single page with interleaved channels
  let channels: Float64Array[];
  let channelNames: string[];
  let bitDepth = 8;

  if (ifds.length >= 2) {
    // Multi-page TIFF: each IFD is a channel
    channels = [];
    for (const ifd of ifds) {
      const rgba = UTIF.toRGBA8(ifd);
      // Extract just the red channel from RGBA (grayscale data ends up in R)
      const ch = new Float64Array(width * height);
      for (let i = 0; i < width * height; i++) {
        ch[i] = rgba[i * 4] / 255;
      }
      channels.push(ch);
    }
    channelNames = channels.length >= 2
      ? ['DAPI', 'cFos', ...Array.from({ length: channels.length - 2 }, (_, i) => `Ch${i + 2}`)]
      : ['Grayscale'];
    bitDepth = (ifds[0] as any).t258?.[0] ?? 8;
  } else {
    // Single page - could be grayscale or RGB
    const ifd = ifds[0];
    const samplesPerPixel = (ifd as any).t277?.[0] ?? 1;
    bitDepth = (ifd as any).t258?.[0] ?? 8;

    if (samplesPerPixel >= 2) {
      // Interleaved multi-channel in single page
      const data = ifd.data;
      channels = [];
      for (let c = 0; c < Math.min(samplesPerPixel, 4); c++) {
        const ch = new Float64Array(width * height);
        const maxVal = (1 << bitDepth) - 1;
        if (bitDepth <= 8) {
          for (let i = 0; i < width * height; i++) {
            ch[i] = (data as Uint8Array)[i * samplesPerPixel + c] / maxVal;
          }
        } else {
          const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
          for (let i = 0; i < width * height; i++) {
            ch[i] = view.getUint16((i * samplesPerPixel + c) * 2, true) / maxVal;
          }
        }
        channels.push(ch);
      }
      channelNames = samplesPerPixel >= 2
        ? ['DAPI', 'cFos', ...Array.from({ length: samplesPerPixel - 2 }, (_, i) => `Ch${i + 2}`)]
        : ['Grayscale'];
    } else {
      // Single channel grayscale
      const rgba = UTIF.toRGBA8(ifd);
      const ch = new Float64Array(width * height);
      for (let i = 0; i < width * height; i++) {
        ch[i] = rgba[i * 4] / 255;
      }
      channels = [ch];
      channelNames = ['Grayscale'];
    }
  }

  // Normalize each channel to [0, 1]
  for (const ch of channels) {
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

  return {
    width,
    height,
    channels,
    channelNames,
    bitDepth,
    fileName: file.name,
  };
}

/**
 * Load a standard image file (PNG, JPEG) as a single-channel grayscale.
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

      // Extract RGB as separate channels
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
