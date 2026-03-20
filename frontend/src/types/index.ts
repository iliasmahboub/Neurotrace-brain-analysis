export interface ImageData {
  width: number;
  height: number;
  channels: Float64Array[];
  channelNames: string[];
  bitDepth: number;
  fileName: string;
}

export interface DetectionResult {
  labels: Int32Array;
  cellCount: number;
  centroids: Array<{ x: number; y: number; id: number; area: number }>;
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
}
