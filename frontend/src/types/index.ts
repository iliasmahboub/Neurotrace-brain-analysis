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
  summary: DetectionSummary;
}

export interface DetectionSummary {
  thresholdUsed: number;
  segmentationMethod: 'watershed' | 'connected-components';
  totalAreaPx: number;
  areaCoverage: number;
  meanAreaPx: number;
  medianAreaPx: number;
  meanCellIntensity: number;
}

export interface DetectionParams {
  sigma: number;
  threshold: number;
  minArea: number;
  maxArea: number;
  autoThreshold: boolean;
  watershed: boolean;
}

export interface DetectionExportContext {
  imageName: string;
  imageWidth: number;
  imageHeight: number;
  bitDepth: number;
  channelCount: number;
  targetChannelIndex: number;
  targetChannelName: string;
  params: DetectionParams;
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

export interface AtlasQcSummary {
  image_name: string;
  atlas_name: string;
  total_cells: number;
  assigned_cells: number;
  unknown_region_cells: number;
  outside_atlas_cells: number;
  border_cells: number;
  near_border_cells: number;
  interior_cells: number;
  assigned_fraction: number;
  unknown_region_fraction: number;
  outside_atlas_fraction: number;
  border_fraction_within_assigned: number;
  near_border_fraction_within_assigned: number;
  interior_fraction_within_assigned: number;
}

export interface AtlasRegionSummaryRow {
  image_name: string;
  atlas_name: string;
  slice_index: string;
  hemisphere: string;
  region_id: string;
  region_acronym: string;
  region_name: string;
  hierarchy_level?: string;
  child_region_count?: string;
  cell_count: string;
  atlas_resolution_um: string;
  pixel_area_um2: string;
  region_area_px: string;
  region_area_um2: string;
  cell_density_per_mm2: string;
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
