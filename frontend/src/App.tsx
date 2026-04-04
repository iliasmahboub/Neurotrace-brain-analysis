import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ImageData as NTImageData,
  ChannelState,
  DetectionParams,
  ViewState,
  BatchItem,
} from './types';
import { loadImage } from './lib/tiff-loader';
import { detectCells } from './lib/detection';
import { exportCSV, exportBatchCSV, exportPNG } from './lib/export';
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
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [activeBatchIndex, setActiveBatchIndex] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionParams, setDetectionParams] = useState<DetectionParams>(DEFAULT_PARAMS);
  const [view, setView] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0, tool: 'pan' });
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.8);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [activeChannel, setActiveChannel] = useState(1);
  const [statusMessage, setStatusMessage] = useState('');

  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Derived state from active batch item
  const activeItem = batch[activeBatchIndex] ?? null;
  const image = activeItem?.image ?? null;
  const channels = activeItem?.channels ?? [];
  const detection = activeItem?.detection ?? null;

  useEffect(() => {
    if (!image) return;
    setActiveChannel(current => Math.min(current, image.channels.length - 1));
    setSelectedCell(null);
  }, [image]);

  const updateActiveItem = useCallback((updates: Partial<BatchItem>) => {
    setBatch(prev => prev.map((item, i) =>
      i === activeBatchIndex ? { ...item, ...updates } : item
    ));
  }, [activeBatchIndex]);

  const handleUpload = useCallback(async (files: File[]) => {
    const newItems: BatchItem[] = [];
    for (const file of files) {
      try {
        setStatusMessage(`Loading ${file.name}...`);
        const img = await loadImage(file);
        newItems.push({
          image: img,
          channels: initChannelStates(img),
          detection: null,
        });
      } catch (err) {
        setStatusMessage(`Error loading ${file.name}: ${err instanceof Error ? err.message : 'Failed'}`);
      }
    }
    if (newItems.length > 0) {
      setBatch(prev => {
        const updated = [...prev, ...newItems];
        setActiveBatchIndex(prev.length); // switch to first new image
        return updated;
      });
      setSelectedCell(null);
      const first = newItems[0].image;
      setActiveChannel(Math.min(1, first.channels.length - 1));
      setStatusMessage(
        newItems.length === 1
          ? `Loaded ${first.width}x${first.height} ${first.bitDepth}-bit image with ${first.channels.length} channels`
          : `Loaded ${newItems.length} images (${batch.length + newItems.length} total)`
      );
    }
  }, [batch.length]);

  const handleRemoveFromBatch = useCallback((index: number) => {
    setBatch(prev => prev.filter((_, i) => i !== index));
    setActiveBatchIndex(prev => {
      if (index < prev) return prev - 1;
      if (index === prev) return Math.max(0, prev - 1);
      return prev;
    });
  }, []);

  const handleChannelChange = useCallback((index: number, updates: Partial<ChannelState>) => {
    setBatch(prev => prev.map((item, i) => {
      if (i !== activeBatchIndex) return item;
      return {
        ...item,
        channels: item.channels.map((ch, ci) => ci === index ? { ...ch, ...updates } : ch),
      };
    }));
  }, [activeBatchIndex]);

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
        updateActiveItem({ detection: result });
        setShowOverlay(true);
        setStatusMessage(`Detected ${result.cellCount} cells`);
      } catch (err) {
        setStatusMessage(`Detection error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      setIsDetecting(false);
    }, 50);
  }, [image, detectionParams, activeChannel, updateActiveItem]);

  const handleRunBatchDetection = useCallback(() => {
    if (batch.length === 0) return;
    setIsDetecting(true);
    setSelectedCell(null);

    setTimeout(() => {
      let processed = 0;
      const updatedBatch = batch.map((item, idx) => {
        try {
          const channelIndex = Math.min(activeChannel, item.image.channels.length - 1);
          setStatusMessage(`Processing ${item.image.fileName} (${idx + 1}/${batch.length})...`);
          const result = detectCells(
            item.image.channels[channelIndex],
            item.image.width,
            item.image.height,
            detectionParams
          );
          processed++;
          return { ...item, detection: result };
        } catch {
          return item;
        }
      });
      setBatch(updatedBatch);
      setShowOverlay(true);
      setStatusMessage(`Batch complete: processed ${processed}/${batch.length} images`);
      setIsDetecting(false);
    }, 50);
  }, [batch, detectionParams, activeChannel]);

  const handleExportPNG = useCallback(() => {
    if (!imageCanvasRef.current || !image) return;
    exportPNG(imageCanvasRef.current, overlayCanvasRef.current, image.fileName);
  }, [image]);

  const handleExportCSV = useCallback(() => {
    if (!detection || !image) return;
    exportCSV(detection, image.fileName);
  }, [detection, image]);

  const handleExportBatchCSV = useCallback(() => {
    const items = batch.filter(item => item.detection !== null);
    if (items.length === 0) return;
    exportBatchCSV(items);
  }, [batch]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleUpload(files);
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
        batch={batch}
        onExportBatchCSV={handleExportBatchCSV}
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
          onRunBatchDetection={handleRunBatchDetection}
          isDetecting={isDetecting}
          detection={detection}
          showOverlay={showOverlay}
          onShowOverlayChange={setShowOverlay}
          overlayOpacity={overlayOpacity}
          onOverlayOpacityChange={setOverlayOpacity}
          selectedCell={selectedCell}
          onSelectedCellChange={setSelectedCell}
          activeChannel={activeChannel}
          onActiveChannelChange={setActiveChannel}
          batch={batch}
          activeBatchIndex={activeBatchIndex}
          onBatchSelect={setActiveBatchIndex}
          onBatchRemove={handleRemoveFromBatch}
        />
      </div>

      {statusMessage && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs pointer-events-none"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}
