import {
  Upload,
  Hand,
  ZoomIn,
  Crosshair,
  FileImage,
  FileSpreadsheet,
  FileJson,
  RotateCcw,
  FolderDown,
  DatabaseZap,
} from 'lucide-react';
import type { ViewState, DetectionResult, ImageData as NTImageData, BatchItem } from '../types';

interface ToolbarProps {
  onUpload: (files: File[]) => void;
  view: ViewState;
  onViewChange: (view: Partial<ViewState>) => void;
  onResetView: () => void;
  image: NTImageData | null;
  detection: DetectionResult | null;
  onExportPNG: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  batch: BatchItem[];
  onExportBatchCSV: () => void;
  onExportBatchJSON: () => void;
  onUploadAtlasArtifacts: (files: File[]) => void;
}

export function Toolbar({
  onUpload,
  view,
  onViewChange,
  onResetView,
  image,
  detection,
  onExportPNG,
  onExportCSV,
  onExportJSON,
  batch,
  onExportBatchCSV,
  onExportBatchJSON,
  onUploadAtlasArtifacts,
}: ToolbarProps) {
  const tools: Array<{ id: ViewState['tool']; icon: typeof Hand; label: string }> = [
    { id: 'pan', icon: Hand, label: 'Pan (Space+Drag)' },
    { id: 'zoom', icon: ZoomIn, label: 'Zoom (Scroll)' },
    { id: 'inspect', icon: Crosshair, label: 'Inspect Cell' },
  ];

  const batchHasDetections = batch.some(item => item.detection !== null);

  return (
    <div className="h-10 flex items-center px-2 gap-1 border-b shrink-0"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3 select-none">
        <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          NT
        </div>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
          NeuroTrace
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

      {/* Upload */}
      <label
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors"
        style={{ color: 'var(--accent)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Upload size={14} />
        <span>Open Image(s)</span>
        <input
          type="file"
          accept=".tif,.tiff,.png,.jpg,.jpeg"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) onUpload(files);
            e.target.value = '';
          }}
        />
      </label>

      <label
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <DatabaseZap size={14} />
        <span>Import Atlas Outputs</span>
        <input
          type="file"
          accept=".csv,.json"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) onUploadAtlasArtifacts(files);
            e.target.value = '';
          }}
        />
      </label>

      <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

      {/* Tools */}
      {tools.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          title={label}
          className="p-1.5 rounded transition-colors"
          style={{
            background: view.tool === id ? 'var(--accent-dim)' : 'transparent',
            color: view.tool === id ? 'var(--accent)' : 'var(--text-secondary)',
          }}
          onMouseEnter={e => {
            if (view.tool !== id) e.currentTarget.style.background = 'var(--bg-hover)';
          }}
          onMouseLeave={e => {
            if (view.tool !== id) e.currentTarget.style.background = 'transparent';
          }}
          onClick={() => onViewChange({ tool: id })}
        >
          <Icon size={15} />
        </button>
      ))}

      <button
        title="Reset View"
        className="p-1.5 rounded transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onClick={onResetView}
      >
        <RotateCcw size={15} />
      </button>

      <div className="flex-1" />

      {/* Zoom display */}
      {image && (
        <span className="text-[11px] mr-2 font-mono" style={{ color: 'var(--text-muted)' }}>
          {Math.round(view.zoom * 100)}%
        </span>
      )}

      {/* Export */}
      {image && (
        <>
          <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />
          <button
            title="Export PNG"
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={onExportPNG}
          >
            <FileImage size={15} />
          </button>
          {detection && (
            <>
              <button
                title="Export CSV (current image)"
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={onExportCSV}
              >
                <FileSpreadsheet size={15} />
              </button>
              <button
                title="Export JSON (current image)"
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={onExportJSON}
              >
                <FileJson size={15} />
              </button>
            </>
          )}
          {batchHasDetections && batch.length > 1 && (
            <>
              <button
                title="Export batch CSV (all images)"
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--accent)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={onExportBatchCSV}
              >
                <FolderDown size={15} />
              </button>
              <button
                title="Export batch JSON (all images)"
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--accent)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={onExportBatchJSON}
              >
                <FileJson size={15} />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
