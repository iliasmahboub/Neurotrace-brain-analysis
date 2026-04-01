export interface ImageData {
  width: number;
  height: number;
  channels: Float64Array[];
  channelNames: string[];
  bitDepth: number;
  fileName: string;
}

export interface CellInfo {
  id: number;
  x: number;
  y: number;
  area: number;
  meanIntensity: number;
}

export interface DetectionResult {
  labels: Int32Array;
  cellCount: number;
  centroids: CellInfo[];
  boundaries: Uint8Array;
  width: number;
  height: number;
}

export interface DetectionParams {
  sigma: number;
  threshold: number;
  minArea: number;
  maxArea: number;
  autoThreshold: boolean;
  watershed: boolean;
}

export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
  tool: 'pan' | 'zoom' | 'inspect';
}

export interface ChannelState {
  visible: boolean;
  color: string;
  brightness: number;
  contrast: number;
}

export interface BatchItem {
  image: ImageData;
  channels: ChannelState[];
  detection: DetectionResult | null;
}

export interface AppState {
  image: ImageData | null;
  detection: DetectionResult | null;
  isDetecting: boolean;
  detectionParams: DetectionParams;
  view: ViewState;
  channels: ChannelState[];
  showOverlay: boolean;
  overlayOpacity: number;
  selectedCell: number | null;
  statusMessage: string;
  batch: BatchItem[];
  activeBatchIndex: number;
}
