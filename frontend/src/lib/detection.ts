import type { DetectionParams, DetectionResult, CellInfo } from '../types';

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
 * Euclidean distance transform on a binary image.
 * For each foreground pixel, compute the distance to the nearest background pixel.
 * Uses the Meijster/Roerdink/Hesselink linear-time algorithm.
 */
function distanceTransform(
  binary: Uint8Array,
  width: number,
  height: number
): Float64Array {
  const INF = width + height;
  const dt = new Float64Array(width * height);

  // Column pass: compute 1D distance along each column
  for (let x = 0; x < width; x++) {
    // Forward
    dt[x] = binary[x] ? 0 : INF;
    for (let y = 1; y < height; y++) {
      const idx = y * width + x;
      dt[idx] = binary[idx] ? 0 : dt[(y - 1) * width + x] + 1;
    }
    // Backward
    for (let y = height - 2; y >= 0; y--) {
      const idx = y * width + x;
      if (dt[(y + 1) * width + x] + 1 < dt[idx]) {
        dt[idx] = dt[(y + 1) * width + x] + 1;
      }
    }
  }

  // Row pass: compute 2D Euclidean distance
  const result = new Float64Array(width * height);
  const s = new Int32Array(width);
  const t = new Int32Array(width);

  for (let y = 0; y < height; y++) {
    const row = y * width;
    let q = 0;
    s[0] = 0;
    t[0] = 0;

    const f = (x: number) => dt[row + x];

    for (let u = 1; u < width; u++) {
      while (q >= 0 && (t[q] - s[q]) * (t[q] - s[q]) + f(s[q]) * f(s[q]) >
                        (t[q] - u) * (t[q] - u) + f(u) * f(u)) {
        q--;
      }
      if (q < 0) {
        q = 0;
        s[0] = u;
      } else {
        // Find separator
        const sep = Math.ceil(
          ((u * u - s[q] * s[q] + f(u) * f(u) - f(s[q]) * f(s[q])) / (2 * (u - s[q])))
        );
        if (sep <= width - 1) {
          q++;
          s[q] = u;
          t[q] = sep;
        }
      }
    }

    for (let u = width - 1; u >= 0; u--) {
      result[row + u] = Math.sqrt(
        (u - s[q]) * (u - s[q]) + f(s[q]) * f(s[q])
      );
      if (u === t[q]) q--;
    }
  }

  return result;
}

/**
 * Watershed segmentation using distance transform.
 * Finds local maxima in the distance map as seeds, then grows regions.
 */
function watershedSegmentation(
  binary: Uint8Array,
  width: number,
  height: number,
  minArea: number
): Int32Array {
  const dist = distanceTransform(binary, width, height);

  // Find local maxima as seeds (using a radius proportional to minArea)
  const seedRadius = Math.max(2, Math.floor(Math.sqrt(minArea / Math.PI)));
  const labels = new Int32Array(width * height);
  let nextLabel = 0;

  // Collect candidate peaks with their distance values
  const peaks: Array<{ x: number; y: number; dist: number }> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!binary[idx]) continue;
      const d = dist[idx];
      if (d < 2) continue; // Skip thin regions

      let isMax = true;
      for (let dy = -seedRadius; dy <= seedRadius && isMax; dy++) {
        for (let dx = -seedRadius; dx <= seedRadius && isMax; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (dist[ny * width + nx] > d) isMax = false;
        }
      }
      if (isMax) peaks.push({ x, y, dist: d });
    }
  }

  // Sort peaks by distance descending (strongest seeds first)
  peaks.sort((a, b) => b.dist - a.dist);

  // Place seeds, skipping peaks too close to an already-placed seed
  const seedLabels: Array<{ x: number; y: number; label: number }> = [];
  for (const peak of peaks) {
    const idx = peak.y * width + peak.x;
    if (labels[idx] !== 0) continue;

    nextLabel++;
    labels[idx] = nextLabel;
    seedLabels.push({ x: peak.x, y: peak.y, label: nextLabel });

    // Mark nearby area to prevent duplicate seeds
    for (let dy = -seedRadius; dy <= seedRadius; dy++) {
      for (let dx = -seedRadius; dx <= seedRadius; dx++) {
        const nx = peak.x + dx, ny = peak.y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (binary[nIdx] && labels[nIdx] === 0) {
          // Only suppress, don't assign label yet
          labels[nIdx] = -1; // temporary marker
        }
      }
    }
  }

  // Reset temporary markers
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === -1) labels[i] = 0;
  }

  // Re-place seeds
  for (const s of seedLabels) {
    labels[s.y * width + s.x] = s.label;
  }

  // BFS watershed expansion: process pixels in order of decreasing distance
  // Build sorted queue of all foreground pixels
  const WATERSHED = -1;
  const queue: Array<{ idx: number; dist: number }> = [];
  for (let i = 0; i < binary.length; i++) {
    if (binary[i]) queue.push({ idx: i, dist: dist[i] });
  }
  queue.sort((a, b) => b.dist - a.dist);

  const dx4 = [1, -1, 0, 0];
  const dy4 = [0, 0, 1, -1];

  // Iterative flooding
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of queue) {
      const i = item.idx;
      if (labels[i] !== 0) continue;
      if (!binary[i]) continue;

      const y = Math.floor(i / width);
      const x = i % width;

      let neighborLabel = 0;
      let conflict = false;

      for (let d = 0; d < 4; d++) {
        const nx = x + dx4[d], ny = y + dy4[d];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nl = labels[ny * width + nx];
        if (nl > 0) {
          if (neighborLabel === 0) {
            neighborLabel = nl;
          } else if (nl !== neighborLabel) {
            conflict = true;
          }
        }
      }

      if (neighborLabel > 0 && !conflict) {
        labels[i] = neighborLabel;
        changed = true;
      } else if (conflict) {
        labels[i] = WATERSHED;
      }
    }
  }

  // Clean up watershed lines: set to 0 (background)
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] < 0) labels[i] = 0;
  }

  return labels;
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

  // Segmentation
  let segLabels: Int32Array;

  if (params.watershed) {
    onProgress?.('Running watershed segmentation...');
    segLabels = watershedSegmentation(binary, width, height, params.minArea);
  } else {
    onProgress?.('Finding connected components...');
    const cc = connectedComponents(binary, width, height);
    segLabels = cc.labels;
  }

  // Compute area, centroid, and mean intensity per component
  const areas = new Map<number, number>();
  const sumX = new Map<number, number>();
  const sumY = new Map<number, number>();
  const sumIntensity = new Map<number, number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const label = segLabels[idx];
      if (label === 0) continue;
      areas.set(label, (areas.get(label) ?? 0) + 1);
      sumX.set(label, (sumX.get(label) ?? 0) + x);
      sumY.set(label, (sumY.get(label) ?? 0) + y);
      sumIntensity.set(label, (sumIntensity.get(label) ?? 0) + channelData[idx]);
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

  for (let i = 0; i < segLabels.length; i++) {
    const label = segLabels[i];
    if (label > 0 && remapTable.has(label)) {
      remapLabels[i] = remapTable.get(label)!;
    }
  }

  // Build centroids with intensity
  const centroids: CellInfo[] = [];
  for (const [oldLabel, newLabel] of remapTable) {
    const area = areas.get(oldLabel)!;
    centroids.push({
      x: Math.round(sumX.get(oldLabel)! / area),
      y: Math.round(sumY.get(oldLabel)! / area),
      id: newLabel,
      area,
      meanIntensity: sumIntensity.get(oldLabel)! / area,
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
