import { useRef, useEffect, useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import type { ImageData as NTImageData, ChannelState, DetectionResult, ViewState } from '../types';
import { renderChannels, renderOverlay } from '../lib/renderer';

interface ImageViewerProps {
  image: NTImageData | null;
  channels: ChannelState[];
  detection: DetectionResult | null;
  view: ViewState;
  onViewChange: (updates: Partial<ViewState>) => void;
  showOverlay: boolean;
  overlayOpacity: number;
  selectedCell: number | null;
  onCellSelect: (cellId: number | null) => void;
  imageCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function ImageViewer({
  image,
  channels,
  detection,
  view,
  onViewChange,
  showOverlay,
  overlayOpacity,
  selectedCell,
  onCellSelect,
  imageCanvasRef,
  overlayCanvasRef,
}: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Render image when channels change
  useEffect(() => {
    if (!image || !imageCanvasRef.current) return;
    renderChannels(imageCanvasRef.current, image, channels);
  }, [image, channels, imageCanvasRef]);

  // Render overlay when detection changes
  useEffect(() => {
    if (!overlayCanvasRef.current) return;
    if (!detection || !showOverlay) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) {
        overlayCanvasRef.current.width = image?.width ?? 0;
        overlayCanvasRef.current.height = image?.height ?? 0;
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
      return;
    }
    renderOverlay(overlayCanvasRef.current, detection, overlayOpacity, selectedCell);
  }, [detection, showOverlay, overlayOpacity, selectedCell, image, overlayCanvasRef]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.05, Math.min(50, view.zoom * factor));

    // Zoom towards cursor
    const rect = containerRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const dx = cx - view.panX;
    const dy = cy - view.panY;

    onViewChange({
      zoom: newZoom,
      panX: cx - dx * (newZoom / view.zoom),
      panY: cy - dy * (newZoom / view.zoom),
    });
  }, [view, onViewChange]);

  // Pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (view.tool === 'pan' || e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - view.panX, y: e.clientY - view.panY });
      e.preventDefault();
    } else if (view.tool === 'inspect' && detection && e.button === 0) {
      // Find clicked cell
      const rect = containerRef.current!.getBoundingClientRect();
      const imgX = Math.floor((e.clientX - rect.left - view.panX) / view.zoom);
      const imgY = Math.floor((e.clientY - rect.top - view.panY) / view.zoom);

      if (imgX >= 0 && imgX < detection.width && imgY >= 0 && imgY < detection.height) {
        const label = detection.labels[imgY * detection.width + imgX];
        onCellSelect(label > 0 ? label : null);
      } else {
        onCellSelect(null);
      }
    }
  }, [view, detection, onCellSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      onViewChange({
        panX: e.clientX - dragStart.x,
        panY: e.clientY - dragStart.y,
      });
    }

    // Track cursor position for status bar
    if (image && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const imgX = Math.floor((e.clientX - rect.left - view.panX) / view.zoom);
      const imgY = Math.floor((e.clientY - rect.top - view.panY) / view.zoom);
      if (imgX >= 0 && imgX < image.width && imgY >= 0 && imgY < image.height) {
        setCursorPos({ x: imgX, y: imgY });
      } else {
        setCursorPos(null);
      }
    }
  }, [isDragging, dragStart, view, image, onViewChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Auto-fit on first load
  useEffect(() => {
    if (!image || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = rect.width / image.width;
    const scaleY = rect.height / image.height;
    const zoom = Math.min(scaleX, scaleY) * 0.9;
    onViewChange({
      zoom,
      panX: (rect.width - image.width * zoom) / 2,
      panY: (rect.height - image.height * zoom) / 2,
    });
  }, [image]);

  const cursorStyle =
    view.tool === 'pan' ? (isDragging ? 'grabbing' : 'grab') :
    view.tool === 'inspect' ? 'crosshair' :
    'default';

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#0a0b0f' }}>
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: cursorStyle }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsDragging(false); setCursorPos(null); }}
      >
        {image ? (
          <div
            style={{
              position: 'absolute',
              transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
              transformOrigin: '0 0',
              imageRendering: view.zoom > 3 ? 'pixelated' : 'auto',
            }}
          >
            <canvas ref={imageCanvasRef} />
            <canvas
              ref={overlayCanvasRef}
              style={{ position: 'absolute', top: 0, left: 0 }}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'var(--bg-panel)', border: '2px dashed var(--border-light)' }}>
              <Upload size={28} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Drop a TIFF or image file here
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              or use Open Image in the toolbar
            </p>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-6 flex items-center px-3 gap-4 text-[10px] font-mono shrink-0"
        style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        {image && (
          <>
            <span>{image.width} x {image.height} px</span>
            <span>{image.bitDepth}-bit</span>
            <span>{image.channels.length} ch</span>
            {cursorPos && (
              <span>
                x:{cursorPos.x} y:{cursorPos.y}
                {image.channels.map((ch, i) => {
                  const idx = cursorPos.y * image.width + cursorPos.x;
                  const val = idx >= 0 && idx < ch.length ? ch[idx] : 0;
                  return (
                    <span key={i} className="ml-2" style={{ color: channels[i]?.color ?? '#fff' }}>
                      {image.channelNames[i]}:{(val ?? 0).toFixed(3)}
                    </span>
                  );
                })}
              </span>
            )}
            <div className="flex-1" />
            <span>{image.fileName}</span>
          </>
        )}
      </div>
    </div>
  );
}
