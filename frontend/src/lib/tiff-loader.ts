import { fromArrayBuffer } from 'geotiff';
import type { ImageData } from '../types';

type RasterData = ArrayLike<number>;

/**
 * Normalize a Float64Array to [0, 1] using min-max scaling.
 */
function normalizeChannel(ch: Float64Array): void {
  if (ch.length === 0) return;
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

function makeChannelNames(count: number, isRGB: boolean): string[] {
  if (count === 1) return ['Grayscale'];
  if (isRGB && count === 3) return ['Red', 'Green', 'Blue'];
  if (count === 2) return ['DAPI', 'cFos'];
  if (count === 3) return ['Ch1', 'Ch2', 'Ch3'];
  return Array.from({ length: count }, (_, i) => `Ch${i + 1}`);
}

function copyRasterToChannel(raster: RasterData, size: number): Float64Array {
  const channel = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    channel[i] = raster[i];
  }
  normalizeChannel(channel);
  return channel;
}

/**
 * Load a TIFF using geotiff, which handles LZW, JPEG, deflate,
 * 8/16/32-bit, float, and virtually every microscopy TIFF format.
 * Returns raw typed arrays with full dynamic range, not crushed to 8-bit.
 */
export async function loadTiff(file: File): Promise<ImageData> {
  const buffer = await file.arrayBuffer();
  const tiff = await fromArrayBuffer(buffer);
  const imageCount = await tiff.getImageCount();

  if (imageCount === 0) {
    throw new Error('No image data found in TIFF file');
  }

  const firstImage = await tiff.getImage(0);
  const width = firstImage.getWidth();
  const height = firstImage.getHeight();
  const bps = firstImage.getBitsPerSample() as unknown as number[];
  const bitDepth = bps[0];
  const spp = firstImage.getSamplesPerPixel();

  const channels: Float64Array[] = [];

  // Count how many pages share the same dimensions as page 0
  // (skip thumbnails / reduced resolution pages)
  let fullResPages = 0;
  for (let i = 0; i < imageCount; i++) {
    const img = await tiff.getImage(i);
    if (img.getWidth() === width && img.getHeight() === height && img.getSamplesPerPixel() === 1) {
      fullResPages++;
    }
  }

  if (fullResPages >= 2 && spp === 1) {
    // Multi-page TIFF where each full-res page is a separate channel
    for (let i = 0; i < imageCount; i++) {
      const image = await tiff.getImage(i);
      if (image.getWidth() !== width || image.getHeight() !== height) continue;
      const rasters = await image.readRasters();
      const band = rasters[0];
      channels.push(copyRasterToChannel(band, width * height));
    }
  } else {
    // Single page (or multi-sample page): split bands into channels
    const rasters = await firstImage.readRasters();
    for (let c = 0; c < rasters.length; c++) {
      channels.push(copyRasterToChannel(rasters[c], width * height));
    }
  }

  if (channels.length === 0) {
    throw new Error('Could not extract any channels from TIFF');
  }

  return {
    width,
    height,
    channels,
    channelNames: makeChannelNames(channels.length, spp >= 3),
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
