import type { ImageData as NTImageData, ChannelState, DetectionResult } from '../types';

/**
 * Parse a hex color to [r, g, b] in 0-255 range.
 */
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/**
 * Render image channels to a canvas with per-channel color, brightness, contrast.
 */
export function renderChannels(
  canvas: HTMLCanvasElement,
  image: NTImageData,
  channelStates: ChannelState[]
): void {
  const { width, height, channels } = image;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  const pixels = imgData.data;

  // Start with black
  pixels.fill(0);

  // Composite each visible channel
  for (let c = 0; c < channels.length; c++) {
    const state = channelStates[c];
    if (!state || !state.visible) continue;

    const chData = channels[c];
    const [cr, cg, cb] = hexToRgb(state.color);
    const brightness = state.brightness;
    const contrast = state.contrast;

    for (let i = 0; i < width * height; i++) {
      // Apply brightness and contrast: out = (val - 0.5) * contrast + 0.5 + brightness
      let val = chData[i];
      val = (val - 0.5) * contrast + 0.5 + brightness;
      val = Math.max(0, Math.min(1, val));

      const pi = i * 4;
      // Additive blending
      pixels[pi] = Math.min(255, pixels[pi] + val * cr);
      pixels[pi + 1] = Math.min(255, pixels[pi + 1] + val * cg);
      pixels[pi + 2] = Math.min(255, pixels[pi + 2] + val * cb);
      pixels[pi + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Render detection overlay (boundaries + centroids) to a separate canvas.
 */
export function renderOverlay(
  canvas: HTMLCanvasElement,
  detection: DetectionResult,
  opacity: number,
  selectedCell: number | null,
  showCentroids: boolean = true
): void {
  const { width, height, boundaries, centroids } = detection;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  const pixels = imgData.data;

  // Draw boundaries
  const alpha = Math.round(opacity * 255);
  for (let i = 0; i < width * height; i++) {
    if (boundaries[i]) {
      const pi = i * 4;
      pixels[pi] = 255;     // R
      pixels[pi + 1] = 60;  // G
      pixels[pi + 2] = 60;  // B
      pixels[pi + 3] = alpha;
    }
  }

  // Highlight selected cell
  if (selectedCell !== null) {
    const { labels } = detection;
    for (let i = 0; i < width * height; i++) {
      if (labels[i] === selectedCell) {
        const pi = i * 4;
        pixels[pi] = 78;
        pixels[pi + 1] = 168;
        pixels[pi + 2] = 246;
        pixels[pi + 3] = Math.round(opacity * 100);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw centroid markers
  if (showCentroids && opacity > 0.3) {
    ctx.globalAlpha = opacity;
    for (const cell of centroids) {
      const isSelected = cell.id === selectedCell;
      ctx.beginPath();
      ctx.arc(cell.x, cell.y, isSelected ? 4 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#4ea8f6' : '#ffcc00';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
