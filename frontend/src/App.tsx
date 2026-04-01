import { useState, useCallback, useRef } from 'react';
import type {
  ImageData as NTImageData,
  ChannelState,
  DetectionParams,
  DetectionResult,
  ViewState,
} from './types';
import { loadImage } from './lib/tiff-loader';
import { detectCells } from './lib/detection';
import { exportCSV, exportPNG } from './lib/export';
import { Toolbar } from './components/Toolbar';
import { ImageViewer } from './components/ImageViewer';
import { Sidebar } from './components/Sidebar';

const CHANNEL_COLORS = ['#4488ff', '#44ff66', '#ff4444', '#ff44ff', '#ffff44', '#44ffff'];

const DEFAULT_PARAMS: DetectionParams = {
  sigma: 1.0,
  threshold: 0.3,
  minArea: 10,
  maxArea: 5000,
  autoThreshold: true,
  watershed: true,
};

const RGB_COLORS = ['#ff4444', '#44ff44', '#4444ff'];

function initChannelStates(image: NTImageData): ChannelState[] {
  const isRGB = image.channelNames[0] === 'Red';
  return image.channelNames.map((_, i) => ({
    visible: true,
    color: isRGB ? RGB_COLORS[i] : CHANNEL_COLORS[i % CHANNEL_COLORS.length],
    brightness: 0,
    contrast: 1,
  }));
}

export default function App() {
  const [image, setImage] = useState<NTImageData | null>(null);
  const [channels, setChannels] = useState<ChannelState[]>([]);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionParams, setDetectionParams] = useState<DetectionParams>(DEFAULT_PARAMS);
  const [view, setView] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0, tool: 'pan' });
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.8);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [activeChannel, setActiveChannel] = useState(1); // cFos by default
  const [statusMessage, setStatusMessage] = useState('');

  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    try {
      setStatusMessage(`Loading ${file.name}...`);
      const img = await loadImage(file);
      setImage(img);
      setChannels(initChannelStates(img));
      setDetection(null);
      setSelectedCell(null);
      setActiveChannel(Math.min(1, img.channels.length - 1));
      setStatusMessage(`Loaded ${img.width}x${img.height} ${img.bitDepth}-bit image with ${img.channels.length} channels`);
    } catch (err) {
      setStatusMessage(`Error: ${err instanceof Error ? err.message : 'Failed to load image'}`);
    }
  }, []);

  const handleChannelChange = useCallback((index: number, updates: Partial<ChannelState>) => {
    setChannels(prev => prev.map((ch, i) => i === index ? { ...ch, ...updates } : ch));
  }, []);

  const handleViewChange = useCallback((updates: Partial<ViewState>) => {
    setView(prev => ({ ...prev, ...updates }));
  }, []);

  const handleResetView = useCallback(() => {
    setView({ zoom: 1, panX: 0, panY: 0, tool: 'pan' });
  }, []);

  const handleParamsChange = useCallback((updates: Partial<DetectionParams>) => {
    setDetectionParams(prev => ({ ...prev, ...updates }));
  }, []);

  const handleRunDetection = useCallback(() => {
    if (!image) return;
    setIsDetecting(true);
    setSelectedCell(null);

    // Use setTimeout to let the UI update before blocking
    setTimeout(() => {
      try {
        const channelIndex = Math.min(activeChannel, image.channels.length - 1);
        const result = detectCells(
          image.channels[channelIndex],
          image.width,
          image.height,
          detectionParams,
          setStatusMessage
        );
        setDetection(result);
        setShowOverlay(true);
        setStatusMessage(`Detected ${result.cellCount} cells`);
      } catch (err) {
        setStatusMessage(`Detection error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      setIsDetecting(false);
    }, 50);
  }, [image, detectionParams, activeChannel]);

  const handleExportPNG = useCallback(() => {
    if (!imageCanvasRef.current || !image) return;
    exportPNG(imageCanvasRef.current, overlayCanvasRef.current, image.fileName);
  }, [image]);

  const handleExportCSV = useCallback(() => {
    if (!detection || !image) return;
    exportCSV(detection, image.fileName);
  }, [detection, image]);

  // Handle file drop on the whole window
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      className="h-full flex flex-col"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Toolbar
        onUpload={handleUpload}
        view={view}
        onViewChange={handleViewChange}
        onResetView={handleResetView}
        image={image}
        detection={detection}
        onExportPNG={handleExportPNG}
        onExportCSV={handleExportCSV}
      />

      <div className="flex-1 flex overflow-hidden">
        <ImageViewer
          image={image}
          channels={channels}
          detection={detection}
          view={view}
          onViewChange={handleViewChange}
          showOverlay={showOverlay}
          overlayOpacity={overlayOpacity}
          selectedCell={selectedCell}
          onCellSelect={setSelectedCell}
          imageCanvasRef={imageCanvasRef}
          overlayCanvasRef={overlayCanvasRef}
        />

        <Sidebar
          image={image}
          channels={channels}
          onChannelChange={handleChannelChange}
          detectionParams={detectionParams}
          onParamsChange={handleParamsChange}
          onRunDetection={handleRunDetection}
          isDetecting={isDetecting}
          detection={detection}
          showOverlay={showOverlay}
          onShowOverlayChange={setShowOverlay}
          overlayOpacity={overlayOpacity}
          onOverlayOpacityChange={setOverlayOpacity}
          selectedCell={selectedCell}
          activeChannel={activeChannel}
          onActiveChannelChange={setActiveChannel}
        />
      </div>

      {/* Global status */}
      {statusMessage && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs pointer-events-none"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}
