import type { DetectionResult, BatchItem, DetectionExportContext, DetectionParams } from '../types';

function serializeParams(params: DetectionParams): string {
  return JSON.stringify(params);
}

function buildCsvMetadataLines(detection: DetectionResult, context: DetectionExportContext): string[] {
  return [
    `# image_name,${context.imageName}`,
    `# image_width,${context.imageWidth}`,
    `# image_height,${context.imageHeight}`,
    `# bit_depth,${context.bitDepth}`,
    `# channel_count,${context.channelCount}`,
    `# target_channel_index,${context.targetChannelIndex}`,
    `# target_channel_name,${context.targetChannelName}`,
    `# detection_params,${serializeParams(context.params)}`,
    `# cell_count,${detection.cellCount}`,
    `# threshold_used,${detection.summary.thresholdUsed.toFixed(4)}`,
    `# segmentation_method,${detection.summary.segmentationMethod}`,
    `# total_area_px,${detection.summary.totalAreaPx}`,
    `# area_coverage,${detection.summary.areaCoverage.toFixed(6)}`,
    `# mean_area_px,${detection.summary.meanAreaPx.toFixed(2)}`,
    `# median_area_px,${detection.summary.medianAreaPx.toFixed(2)}`,
    `# mean_cell_intensity,${detection.summary.meanCellIntensity.toFixed(6)}`,
  ];
}

export function exportCSV(detection: DetectionResult, context: DetectionExportContext): void {
  const rows = [
    ...buildCsvMetadataLines(detection, context),
    '',
    ['cell_id', 'centroid_x', 'centroid_y', 'area_px', 'mean_intensity'].join(','),
    ...detection.centroids.map(c =>
      [c.id, c.x, c.y, c.area, c.meanIntensity.toFixed(4)].join(',')
    ),
  ];

  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, `${context.imageName.replace(/\.[^.]+$/, '')}_cells.csv`);
}

export function exportDetectionJson(
  detection: DetectionResult,
  context: DetectionExportContext,
): void {
  const payload = {
    schemaVersion: 1,
    exportType: 'neurotrace-detection',
    context,
    summary: detection.summary,
    cells: detection.centroids,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${context.imageName.replace(/\.[^.]+$/, '')}_detection.json`);
}

function inferBatchContext(item: BatchItem, targetChannelIndex: number, params: DetectionParams): DetectionExportContext {
  const channelIndex = Math.min(targetChannelIndex, item.image.channels.length - 1);
  return {
    imageName: item.image.fileName,
    imageWidth: item.image.width,
    imageHeight: item.image.height,
    bitDepth: item.image.bitDepth,
    channelCount: item.image.channels.length,
    targetChannelIndex: channelIndex,
    targetChannelName: item.image.channelNames[channelIndex] ?? `Ch${channelIndex + 1}`,
    params,
  };
}

export function exportBatchCSV(
  items: BatchItem[],
  targetChannelIndex: number,
  params: DetectionParams,
): void {
  const cellRows = [
    [
      'filename',
      'image_width',
      'image_height',
      'bit_depth',
      'target_channel_index',
      'target_channel_name',
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
      'image_width',
      'image_height',
      'bit_depth',
      'channel_count',
      'target_channel_index',
      'target_channel_name',
      'detection_params',
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
    const context = inferBatchContext(item, targetChannelIndex, params);

    if (!item.detection) {
      summaryRows.push(
        [
          item.image.fileName,
          'not_run',
          item.image.width,
          item.image.height,
          item.image.bitDepth,
          item.image.channels.length,
          context.targetChannelIndex,
          context.targetChannelName,
          serializeParams(params),
          0,
          '',
          '',
          0,
          0,
          0,
          0,
          0,
        ].join(',')
      );
      continue;
    }

    summaryRows.push(
      [
        item.image.fileName,
        'completed',
        item.image.width,
        item.image.height,
        item.image.bitDepth,
        item.image.channels.length,
        context.targetChannelIndex,
        context.targetChannelName,
        serializeParams(params),
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
          item.image.width,
          item.image.height,
          item.image.bitDepth,
          context.targetChannelIndex,
          context.targetChannelName,
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

export function exportBatchJson(
  items: BatchItem[],
  targetChannelIndex: number,
  params: DetectionParams,
): void {
  const payload = {
    schemaVersion: 1,
    exportType: 'neurotrace-batch-detection',
    detectionParams: params,
    items: items.map(item => ({
      context: inferBatchContext(item, targetChannelIndex, params),
      detection: item.detection
        ? {
            summary: item.detection.summary,
            cellCount: item.detection.cellCount,
            cells: item.detection.centroids,
          }
        : null,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'neurotrace_batch_detection.json');
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
