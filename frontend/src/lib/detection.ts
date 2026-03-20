import type { DetectionParams, DetectionResult } from '../types';

/**
 * Apply Gaussian blur to a single-channel image.
 * Separable 2D convolution for performance.
 */
function gaussianBlur(
  data: Float64Array,
  width: number,
  height: number,
  sigma: number
): Float64Array {
  if (sigma <= 0) return new Float64Array(data);

  const radius = Math.ceil(sigma * 3);
  const size = radius * 2 + 1;
  const kernel = new Float64Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;

  // Horizontal pass
  const temp = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let val = 0;
      for (let k = 0; k < size; k++) {
        const sx = Math.min(Math.max(x + k - radius, 0), width - 1);
        val += data[y * width + sx] * kernel[k];
      }
      temp[y * width + x] = val;
    }
  }

  // Vertical pass
  const result = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let val = 0;
      for (let k = 0; k < size; k++) {
        const sy = Math.min(Math.max(y + k - radius, 0), height - 1);
        val += temp[sy * width + x] * kernel[k];
      }
      result[y * width + x] = val;
    }
  }

  return result;
}

/**
 * Compute Otsu's threshold for a normalized [0,1] image.
 */
function otsuThreshold(data: Float64Array): number {
  const bins = 256;
  const histogram = new Float64Array(bins);
  for (let i = 0; i < data.length; i++) {
    const bin = Math.min(Math.floor(data[i] * (bins - 1)), bins - 1);
    histogram[bin]++;
  }

  const total = data.length;
  let sumAll = 0;
  for (let i = 0; i < bins; i++) sumAll += i * histogram[i];

  let sumBg = 0;
  let weightBg = 0;
  let maxVariance = 0;
  let bestThreshold = 0;

  for (let t = 0; t < bins; t++) {
    weightBg += histogram[t];
    if (weightBg === 0) continue;

    const weightFg = total - weightBg;
    if (weightFg === 0) break;

    sumBg += t * histogram[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;

    const variance = weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg);
    if (variance > maxVariance) {
      maxVariance = variance;
      bestThreshold = t;
    }
  }

  return bestThreshold / (bins - 1);
}

/**
 * Connected component labeling using union-find (4-connectivity).
 */
function connectedComponents(
  binary: Uint8Array,
  width: number,
  height: number
): { labels: Int32Array; count: number } {
  const labels = new Int32Array(width * height);
  const parent: number[] = [];
  let nextLabel = 1;

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  // First pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!binary[idx]) continue;

      const above = y > 0 ? labels[(y - 1) * width + x] : 0;
      const left = x > 0 ? labels[y * width + (x - 1)] : 0;

      if (above === 0 && left === 0) {
        labels[idx] = nextLabel;
        parent[nextLabel] = nextLabel;
        nextLabel++;
      } else if (above > 0 && left === 0) {
        labels[idx] = above;
      } else if (above === 0 && left > 0) {
        labels[idx] = left;
      } else {
        labels[idx] = above;
        if (above !== left) union(above, left);
      }
    }
  }

  // Second pass - resolve labels
  const labelMap = new Map<number, number>();
  let finalCount = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === 0) continue;
    const root = find(labels[i]);
    if (!labelMap.has(root)) {
      labelMap.set(root, ++finalCount);
    }
    labels[i] = labelMap.get(root)!;
  }

  return { labels, count: finalCount };
}

/**
 * Extract boundary pixels from a label image.
 */
function findBoundaries(
  labels: Int32Array,
  width: number,
  height: number
): Uint8Array {
  const boundaries = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const label = labels[idx];
      if (label === 0) continue;

      // Check 4-connected neighbors
      const isBoundary =
        (x === 0 || labels[idx - 1] !== label) ||
        (x === width - 1 || labels[idx + 1] !== label) ||
        (y === 0 || labels[(y - 1) * width + x] !== label) ||
        (y === height - 1 || labels[(y + 1) * width + x] !== label);

      if (isBoundary) boundaries[idx] = 1;
    }
  }

  return boundaries;
}

/**
 * Run the full cell detection pipeline:
 * 1. Gaussian blur
 * 2. Threshold (Otsu or manual)
 * 3. Connected components
 * 4. Size filtering
 * 5. Extract boundaries & centroids
 */
export function detectCells(
  channelData: Float64Array,
  width: number,
  height: number,
  params: DetectionParams,
  onProgress?: (msg: string) => void
): DetectionResult {
  onProgress?.('Applying Gaussian blur...');
  const blurred = gaussianBlur(channelData, width, height, params.sigma);

  // Threshold
  const threshold = params.autoThreshold
    ? otsuThreshold(blurred)
    : params.threshold;
  onProgress?.(`Thresholding at ${threshold.toFixed(3)}...`);

  const binary = new Uint8Array(width * height);
  for (let i = 0; i < blurred.length; i++) {
    binary[i] = blurred[i] > threshold ? 1 : 0;
  }

  // Connected components
  onProgress?.('Finding connected components...');
  const { labels, count } = connectedComponents(binary, width, height);

  // Compute area and centroid per component
  const areas = new Map<number, number>();
  const sumX = new Map<number, number>();
  const sumY = new Map<number, number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const label = labels[y * width + x];
      if (label === 0) continue;
      areas.set(label, (areas.get(label) ?? 0) + 1);
      sumX.set(label, (sumX.get(label) ?? 0) + x);
      sumY.set(label, (sumY.get(label) ?? 0) + y);
    }
  }

  // Filter by size
  const validLabels = new Set<number>();
  for (const [label, area] of areas) {
    if (area >= params.minArea && area <= params.maxArea) {
      validLabels.add(label);
    }
  }

  // Remap labels to keep only valid ones
  const remapLabels = new Int32Array(width * height);
  const remapTable = new Map<number, number>();
  let newId = 0;
  for (const label of validLabels) {
    remapTable.set(label, ++newId);
  }

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label > 0 && remapTable.has(label)) {
      remapLabels[i] = remapTable.get(label)!;
    }
  }

  // Build centroids
  const centroids: Array<{ x: number; y: number; id: number; area: number }> = [];
  for (const [oldLabel, newLabel] of remapTable) {
    const area = areas.get(oldLabel)!;
    centroids.push({
      x: Math.round(sumX.get(oldLabel)! / area),
      y: Math.round(sumY.get(oldLabel)! / area),
      id: newLabel,
      area,
    });
  }

  onProgress?.('Extracting boundaries...');
  const boundaries = findBoundaries(remapLabels, width, height);

  onProgress?.(`Detection complete: ${centroids.length} cells found`);

  return {
    labels: remapLabels,
    cellCount: centroids.length,
    centroids,
    boundaries,
    width,
    height,
  };
}

/**
 * Compute Otsu threshold for display in the UI.
 */
export function computeOtsuThreshold(
  channelData: Float64Array,
  width: number,
  height: number,
  sigma: number
): number {
  const blurred = gaussianBlur(channelData, width, height, sigma);
  return otsuThreshold(blurred);
}
