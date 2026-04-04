import type { DetectionResult, BatchItem } from '../types';

export function exportCSV(detection: DetectionResult, imageName: string): void {
  const rows = [
    `# image_name,${imageName}`,
    `# cell_count,${detection.cellCount}`,
    `# threshold_used,${detection.summary.thresholdUsed.toFixed(4)}`,
    `# segmentation_method,${detection.summary.segmentationMethod}`,
    `# total_area_px,${detection.summary.totalAreaPx}`,
    `# area_coverage,${detection.summary.areaCoverage.toFixed(6)}`,
    `# mean_area_px,${detection.summary.meanAreaPx.toFixed(2)}`,
    `# median_area_px,${detection.summary.medianAreaPx.toFixed(2)}`,
    `# mean_cell_intensity,${detection.summary.meanCellIntensity.toFixed(6)}`,
    '',
    ['cell_id', 'centroid_x', 'centroid_y', 'area_px', 'mean_intensity'].join(','),
    ...detection.centroids.map(c =>
      [c.id, c.x, c.y, c.area, c.meanIntensity.toFixed(4)].join(',')
    ),
  ];

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, `${imageName.replace(/\.[^.]+$/, '')}_cells.csv`);
}

export function exportBatchCSV(items: BatchItem[]): void {
  const cellRows = [
    [
      'filename',
      'cell_id',
      'centroid_x',
      'centroid_y',
      'area_px',
      'mean_intensity',
      'threshold_used',
      'segmentation_method',
    ].join(','),
  ];
  const summaryRows = [
    [
      'filename',
      'detection_status',
      'cell_count',
      'threshold_used',
      'segmentation_method',
      'total_area_px',
      'area_coverage',
      'mean_area_px',
      'median_area_px',
      'mean_cell_intensity',
    ].join(','),
  ];

  for (const item of items) {
    if (!item.detection) {
      summaryRows.push(
        [item.image.fileName, 'not_run', 0, '', '', 0, 0, 0, 0, 0].join(',')
      );
      continue;
    }

    summaryRows.push(
      [
        item.image.fileName,
        'completed',
        item.detection.cellCount,
        item.detection.summary.thresholdUsed.toFixed(4),
        item.detection.summary.segmentationMethod,
        item.detection.summary.totalAreaPx,
        item.detection.summary.areaCoverage.toFixed(6),
        item.detection.summary.meanAreaPx.toFixed(2),
        item.detection.summary.medianAreaPx.toFixed(2),
        item.detection.summary.meanCellIntensity.toFixed(6),
      ].join(',')
    );

    for (const c of item.detection.centroids) {
      cellRows.push(
        [
          item.image.fileName,
          c.id,
          c.x,
          c.y,
          c.area,
          c.meanIntensity.toFixed(4),
          item.detection.summary.thresholdUsed.toFixed(4),
          item.detection.summary.segmentationMethod,
        ].join(',')
      );
    }
  }

  const cellsBlob = new Blob([cellRows.join('\n')], { type: 'text/csv' });
  const summaryBlob = new Blob([summaryRows.join('\n')], { type: 'text/csv' });
  downloadBlob(cellsBlob, 'neurotrace_batch_cells.csv');
  downloadBlob(summaryBlob, 'neurotrace_batch_summary.csv');
}

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
