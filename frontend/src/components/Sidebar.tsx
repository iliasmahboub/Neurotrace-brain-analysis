import { useState } from 'react';
import {
  Eye,
  EyeOff,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  Microscope,
  Layers,
  SlidersHorizontal,
  BarChart3,
  Images,
  X,
  Zap,
  Check,
  Database,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';
import type {
  ImageData as NTImageData,
  AtlasQcSummary,
  AtlasReviewRow,
  AtlasRegionSummaryRow,
  ChannelState,
  DetectionParams,
  DetectionResult,
  BatchItem,
} from '../types';

interface SidebarProps {
  image: NTImageData | null;
  channels: ChannelState[];
  onChannelChange: (index: number, updates: Partial<ChannelState>) => void;
  detectionParams: DetectionParams;
  onParamsChange: (updates: Partial<DetectionParams>) => void;
  onRunDetection: () => void;
  onRunBatchDetection: () => void;
  isDetecting: boolean;
  detection: DetectionResult | null;
  showOverlay: boolean;
  onShowOverlayChange: (show: boolean) => void;
  overlayOpacity: number;
  onOverlayOpacityChange: (opacity: number) => void;
  selectedCell: number | null;
  onSelectedCellChange: (cellId: number | null) => void;
  activeChannel: number;
  onActiveChannelChange: (index: number) => void;
  batch: BatchItem[];
  activeBatchIndex: number;
  onBatchSelect: (index: number) => void;
  onBatchRemove: (index: number) => void;
  atlasQcSummary: AtlasQcSummary | null;
  atlasLeafSummary: AtlasRegionSummaryRow[];
  atlasHierarchySummary: AtlasRegionSummaryRow[];
  atlasReviewRows: AtlasReviewRow[];
  atlasOverlayLoaded: boolean;
}

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon: typeof Layers;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b" style={{ borderColor: 'var(--border)' }}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold tracking-wide transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onClick={() => setOpen(!open)}
      >
        <Icon size={13} />
        <span className="uppercase">{title}</span>
        {badge && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            {badge}
          </span>
        )}
        <div className="flex-1" />
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

const CHANNEL_COLORS = ['#4488ff', '#44ff66', '#ff4444', '#ff44ff', '#ffff44', '#44ffff'];

export function Sidebar({
  image,
  channels,
  onChannelChange,
  detectionParams,
  onParamsChange,
  onRunDetection,
  onRunBatchDetection,
  isDetecting,
  detection,
  showOverlay,
  onShowOverlayChange,
  overlayOpacity,
  onOverlayOpacityChange,
  selectedCell,
  onSelectedCellChange,
  activeChannel,
  onActiveChannelChange,
  batch,
  activeBatchIndex,
  onBatchSelect,
  onBatchRemove,
  atlasQcSummary,
  atlasLeafSummary,
  atlasHierarchySummary,
  atlasReviewRows,
  atlasOverlayLoaded,
}: SidebarProps) {
  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  if (!image && batch.length === 0) {
    return (
      <div className="w-64 shrink-0 flex flex-col items-center justify-center border-l"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <Microscope size={32} style={{ color: 'var(--text-muted)' }} />
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          Load an image to begin
        </p>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 flex flex-col border-l overflow-y-auto"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>

      {/* Batch */}
      {batch.length > 1 && (
        <Section title="Batch" icon={Images} badge={String(batch.length)}>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {batch.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs cursor-pointer transition-colors group"
                style={{
                  background: i === activeBatchIndex ? 'var(--accent-dim)' : 'transparent',
                  color: i === activeBatchIndex ? 'var(--accent)' : 'var(--text-secondary)',
                }}
                onMouseEnter={e => {
                  if (i !== activeBatchIndex) e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={e => {
                  if (i !== activeBatchIndex) e.currentTarget.style.background = 'transparent';
                }}
                onClick={() => onBatchSelect(i)}
              >
                {item.detection ? (
                  <Check size={10} style={{ color: 'var(--success)', flexShrink: 0 }} />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full border shrink-0"
                    style={{ borderColor: 'var(--text-muted)' }} />
                )}
                <span className="truncate flex-1 font-mono text-[10px]">
                  {item.image.fileName}
                </span>
                {item.detection && (
                  <span className="text-[9px] font-mono" style={{ color: 'var(--success)' }}>
                    {item.detection.cellCount}
                  </span>
                )}
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={e => { e.stopPropagation(); onBatchRemove(i); }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Channels */}
      {image && (
        <Section title="Channels" icon={Layers}>
          <div className="space-y-2">
            {image.channelNames.map((name, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 mb-1">
                  <button
                    className="p-0.5 rounded transition-colors"
                    style={{ color: channels[i]?.visible ? channels[i]?.color : 'var(--text-muted)' }}
                    onClick={() => onChannelChange(i, { visible: !channels[i]?.visible })}
                  >
                    {channels[i]?.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>

                  <button
                    className="flex-1 text-left text-xs py-0.5 px-1.5 rounded transition-colors"
                    style={{
                      color: activeChannel === i ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: activeChannel === i ? 'var(--bg-active)' : 'transparent',
                    }}
                    onClick={() => onActiveChannelChange(i)}
                  >
                    {name}
                  </button>

                  <input
                    type="color"
                    value={channels[i]?.color ?? CHANNEL_COLORS[i]}
                    onChange={e => onChannelChange(i, { color: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 p-0"
                    style={{ background: 'transparent' }}
                  />
                </div>

                {activeChannel === i && (
                  <div className="ml-5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-12" style={{ color: 'var(--text-muted)' }}>Bright</span>
                      <input
                        type="range"
                        min={-0.5}
                        max={0.5}
                        step={0.01}
                        value={channels[i]?.brightness ?? 0}
                        onChange={e => onChannelChange(i, { brightness: parseFloat(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-[10px] w-8 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                        {((channels[i]?.brightness ?? 0) * 100).toFixed(0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-12" style={{ color: 'var(--text-muted)' }}>Contr</span>
                      <input
                        type="range"
                        min={0.2}
                        max={5}
                        step={0.05}
                        value={channels[i]?.contrast ?? 1}
                        onChange={e => onChannelChange(i, { contrast: parseFloat(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-[10px] w-8 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                        {((channels[i]?.contrast ?? 1) * 100).toFixed(0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Detection */}
      {image && (
        <Section title="Detection" icon={SlidersHorizontal}>
          <div className="space-y-3">
            {/* Active channel selector */}
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block"
                style={{ color: 'var(--text-muted)' }}>
                Target Channel
              </label>
              <select
                value={activeChannel}
                onChange={e => onActiveChannelChange(parseInt(e.target.value))}
                className="w-full text-xs"
              >
                {image.channelNames.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>

            {/* Sigma */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Gaussian Sigma
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  {detectionParams.sigma.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={detectionParams.sigma}
                onChange={e => onParamsChange({ sigma: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Threshold */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Threshold
                </span>
                <label className="flex items-center gap-1 ml-auto cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detectionParams.autoThreshold}
                    onChange={e => onParamsChange({ autoThreshold: e.target.checked })}
                    className="w-3 h-3 accent-blue-500"
                  />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Auto</span>
                </label>
              </div>
              {!detectionParams.autoThreshold && (
                <>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.005}
                    value={detectionParams.threshold}
                    onChange={e => onParamsChange({ threshold: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-right text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    {detectionParams.threshold.toFixed(3)}
                  </div>
                </>
              )}
            </div>

            {/* Watershed toggle */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={detectionParams.watershed}
                  onChange={e => onParamsChange({ watershed: e.target.checked })}
                  className="w-3 h-3 accent-blue-500"
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Watershed (split touching cells)
                </span>
              </label>
            </div>

            {/* Min/Max area */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] uppercase tracking-wider block mb-1"
                  style={{ color: 'var(--text-muted)' }}>Min Area</span>
                <input
                  type="number"
                  value={detectionParams.minArea}
                  onChange={e => onParamsChange({ minArea: parseInt(e.target.value) || 0 })}
                  className="w-full text-xs px-2 py-1 rounded"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider block mb-1"
                  style={{ color: 'var(--text-muted)' }}>Max Area</span>
                <input
                  type="number"
                  value={detectionParams.maxArea}
                  onChange={e => onParamsChange({ maxArea: parseInt(e.target.value) || 10000 })}
                  className="w-full text-xs px-2 py-1 rounded"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Run buttons */}
            <div className="space-y-1.5">
              <button
                className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-semibold transition-all"
                style={{
                  background: isDetecting ? 'var(--bg-hover)' : 'var(--accent)',
                  color: isDetecting ? 'var(--text-muted)' : '#fff',
                  opacity: isDetecting ? 0.7 : 1,
                }}
                disabled={isDetecting}
                onClick={onRunDetection}
              >
                {isDetecting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Run Detection
                  </>
                )}
              </button>

              {batch.length > 1 && (
                <button
                  className="w-full flex items-center justify-center gap-2 py-1.5 rounded text-xs font-semibold transition-all"
                  style={{
                    background: isDetecting ? 'var(--bg-hover)' : 'transparent',
                    color: isDetecting ? 'var(--text-muted)' : 'var(--accent)',
                    border: `1px solid ${isDetecting ? 'var(--border)' : 'var(--accent)'}`,
                    opacity: isDetecting ? 0.7 : 1,
                  }}
                  disabled={isDetecting}
                  onClick={onRunBatchDetection}
                >
                  <Zap size={13} />
                  Detect All ({batch.length})
                </button>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Results */}
      {detection && (
        <Section title="Results" icon={BarChart3}>
          <div className="space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded p-2 text-center" style={{ background: 'var(--success-dim)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--success)' }}>
                  {detection.cellCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Cells
                </div>
              </div>
              <div className="rounded p-2 text-center" style={{ background: 'var(--accent-dim)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
                  {Math.round(detection.summary.meanAreaPx)}
                </div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Avg Area
                </div>
              </div>
              <div className="rounded p-2 text-center" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {(detection.summary.areaCoverage * 100).toFixed(2)}%
                </div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Coverage
                </div>
              </div>
              <div className="rounded p-2 text-center" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <div className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {detection.summary.thresholdUsed.toFixed(3)}
                </div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Threshold
                </div>
              </div>
            </div>

            {/* Overlay controls */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  className="p-0.5 rounded"
                  style={{ color: showOverlay ? 'var(--accent)' : 'var(--text-muted)' }}
                  onClick={() => onShowOverlayChange(!showOverlay)}
                >
                  {showOverlay ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Overlay
                </span>
                <div className="flex-1" />
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  {Math.round(overlayOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={overlayOpacity}
                onChange={e => onOverlayOpacityChange(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Selected cell info */}
            {selectedCell !== null && (() => {
              const cell = detection.centroids.find(c => c.id === selectedCell);
              if (!cell) return null;
              return (
                <div className="rounded p-2" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--accent)' }}>
                    Cell #{cell.id}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    <div>X: <span className="font-mono">{cell.x}</span></div>
                    <div>Y: <span className="font-mono">{cell.y}</span></div>
                    <div>Area: <span className="font-mono">{cell.area}px</span></div>
                    <div>Int: <span className="font-mono">{cell.meanIntensity.toFixed(3)}</span></div>
                  </div>
                </div>
              );
            })()}

            {/* Cell list (compact) */}
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                Cell List
              </div>
              <div className="max-h-48 overflow-y-auto rounded" style={{ background: 'var(--bg-primary)' }}>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                      <th className="py-1 px-2 text-left font-medium">ID</th>
                      <th className="py-1 px-2 text-right font-medium">X</th>
                      <th className="py-1 px-2 text-right font-medium">Y</th>
                      <th className="py-1 px-2 text-right font-medium">Area</th>
                      <th className="py-1 px-2 text-right font-medium">Int</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detection.centroids.slice(0, 200).map(cell => (
                      <tr
                        key={cell.id}
                        className="cursor-pointer transition-colors"
                        style={{
                          color: selectedCell === cell.id ? 'var(--accent)' : 'var(--text-secondary)',
                          background: selectedCell === cell.id ? 'var(--accent-dim)' : 'transparent',
                        }}
                        onMouseEnter={e => {
                          if (selectedCell !== cell.id)
                            e.currentTarget.style.background = 'var(--bg-hover)';
                        }}
                        onMouseLeave={e => {
                          if (selectedCell !== cell.id)
                            e.currentTarget.style.background = 'transparent';
                        }}
                        onClick={() => {
                          onShowOverlayChange(true);
                          onSelectedCellChange(cell.id);
                        }}
                      >
                        <td className="py-0.5 px-2 font-mono">{cell.id}</td>
                        <td className="py-0.5 px-2 text-right font-mono">{cell.x}</td>
                        <td className="py-0.5 px-2 text-right font-mono">{cell.y}</td>
                        <td className="py-0.5 px-2 text-right font-mono">{cell.area}</td>
                        <td className="py-0.5 px-2 text-right font-mono">{cell.meanIntensity.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detection.centroids.length > 200 && (
                  <div className="text-center py-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    +{detection.centroids.length - 200} more cells
                  </div>
                )}
              </div>
            </div>
          </div>
        </Section>
      )}

      {(atlasQcSummary || atlasLeafSummary.length > 0 || atlasHierarchySummary.length > 0) && (
        <Section
          title="Atlas"
          icon={Database}
          badge={atlasQcSummary?.atlas_name ?? (atlasHierarchySummary.length > 0 ? 'loaded' : undefined)}
        >
          <div className="space-y-3">
            {atlasOverlayLoaded && (
              <div
                className="rounded px-2 py-1.5 flex items-center gap-2"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
              >
                <ImageIcon size={12} style={{ color: 'var(--accent)' }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                  QC Overlay Loaded
                </span>
              </div>
            )}

            {atlasQcSummary && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded p-2 text-center" style={{ background: 'var(--accent-dim)' }}>
                    <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
                      {(atlasQcSummary.assigned_fraction * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Assigned
                    </div>
                  </div>
                  <div className="rounded p-2 text-center" style={{ background: 'var(--danger-dim)' }}>
                    <div className="text-lg font-bold" style={{ color: 'var(--danger)' }}>
                      {atlasQcSummary.outside_atlas_cells + atlasQcSummary.unknown_region_cells}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Failures
                    </div>
                  </div>
                </div>

                <div className="rounded p-2" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle size={12} style={{ color: 'var(--warning)' }} />
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--warning)' }}>
                      Boundary Risk
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    <div>Border: <span className="font-mono">{atlasQcSummary.border_cells}</span></div>
                    <div>Near: <span className="font-mono">{atlasQcSummary.near_border_cells}</span></div>
                    <div>Interior: <span className="font-mono">{atlasQcSummary.interior_cells}</span></div>
                  </div>
                </div>
              </>
            )}

            {atlasLeafSummary.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                  Top Leaf Regions
                </div>
                <div className="max-h-36 overflow-y-auto rounded" style={{ background: 'var(--bg-primary)' }}>
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        <th className="py-1 px-2 text-left font-medium">Region</th>
                        <th className="py-1 px-2 text-right font-medium">Cells</th>
                        <th className="py-1 px-2 text-right font-medium">Density</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atlasLeafSummary
                        .slice()
                        .sort((left, right) => Number(right.cell_count) - Number(left.cell_count))
                        .slice(0, 8)
                        .map(row => (
                          <tr key={`${row.region_id}-${row.region_name}`} style={{ color: 'var(--text-secondary)' }}>
                            <td className="py-1 px-2">
                              <div className="truncate">{row.region_acronym || row.region_name}</div>
                            </td>
                            <td className="py-1 px-2 text-right font-mono">{row.cell_count}</td>
                            <td className="py-1 px-2 text-right font-mono">
                              {row.cell_density_per_mm2 ? Number(row.cell_density_per_mm2).toFixed(1) : '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {atlasHierarchySummary.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                  Parent Regions
                </div>
                <div className="space-y-1">
                  {atlasHierarchySummary
                    .filter(row => Number(row.child_region_count || '0') > 1)
                    .sort((left, right) => Number(right.cell_count) - Number(left.cell_count))
                    .slice(0, 5)
                    .map(row => (
                      <div
                        key={`${row.region_id}-${row.region_name}`}
                        className="rounded px-2 py-1.5 flex items-center gap-2"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                            {row.region_name}
                          </div>
                          <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                            {row.child_region_count} child regions
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                            {row.cell_count}
                          </div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            cells
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {atlasReviewRows.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                  Review Queue
                </div>
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {atlasReviewRows
                    .slice()
                    .sort((left, right) => {
                      const leftRank = priorityOrder[left.review_priority] ?? 99;
                      const rightRank = priorityOrder[right.review_priority] ?? 99;
                      return leftRank - rightRank;
                    })
                    .slice(0, 10)
                    .map(row => (
                      <div
                        key={`${row.cell_id}-${row.assignment_status}-${row.review_priority}`}
                        className="rounded px-2 py-1.5"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase"
                            style={{
                              background:
                                row.review_priority === 'critical'
                                  ? 'var(--danger-dim)'
                                  : row.review_priority === 'high'
                                    ? 'rgba(245, 158, 11, 0.14)'
                                    : row.review_priority === 'medium'
                                      ? 'var(--accent-dim)'
                                      : 'var(--bg-hover)',
                              color:
                                row.review_priority === 'critical'
                                  ? 'var(--danger)'
                                  : row.review_priority === 'high'
                                    ? 'var(--warning)'
                                    : row.review_priority === 'medium'
                                      ? 'var(--accent)'
                                      : 'var(--text-secondary)',
                            }}
                          >
                            {row.review_priority}
                          </span>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                            Cell {row.cell_id}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: 'var(--text-primary)' }}>
                          {row.region_name || row.assignment_status}
                        </div>
                        <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                          {row.assignment_status}
                          {row.region_boundary_proximity ? ` • ${row.region_boundary_proximity}` : ''}
                          {row.region_boundary_distance_um ? ` • ${Number(row.region_boundary_distance_um).toFixed(1)} um` : ''}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
