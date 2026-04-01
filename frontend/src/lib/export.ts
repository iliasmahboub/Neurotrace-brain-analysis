import type { DetectionResult, ImageData as NTImageData } from '../types';

/**
 * Export detection results as CSV.
 */
export function exportCSV(detection: DetectionResult, imageName: string): void {
  const rows = [
    ['cell_id', 'centroid_x', 'centroid_y', 'area_px', 'mean_intensity'].join(','),
    ...detection.centroids.map(c =>
      [c.id, c.x, c.y, c.area, c.meanIntensity.toFixed(4)].join(',')
    ),
  ];

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, `${imageName.replace(/\.[^.]+$/, '')}_cells.csv`);
}

/**
 * Export the current canvas view as PNG.
 */
export function exportPNG(
  imageCanvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement | null,
  imageName: string
): void {
  const merged = document.createElement('canvas');
  merged.width = imageCanvas.width;
  merged.height = imageCanvas.height;
  const ctx = merged.getContext('2d')!;
  ctx.drawImage(imageCanvas, 0, 0);
  if (overlayCanvas) {
    ctx.drawImage(overlayCanvas, 0, 0);
  }
  merged.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${imageName.replace(/\.[^.]+$/, '')}_annotated.png`);
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
