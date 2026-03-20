# NeuroTrace

### Automated cFos+ Cell Detection in Fluorescence Brain Slices

A browser-based analysis tool for immunofluorescence brain slice images. Upload a multi-channel TIFF, detect cFos+ cells, adjust parameters in real time, and export annotated figures and quantification data. No installation required.

**[Launch NeuroTrace](https://iliasmahboub.github.io/neurotrace/)**

I am building this to replace the manual ImageJ/QuPath cell counting workflow that most neuroscience labs still do by hand. The goal is a complete pipeline from raw fluorescence images to publication-ready figures with per-region cell counts, starting with a clean browser UI and extending to atlas registration and batch processing.

Built to support cFos quantification in circuit neuroscience research at Duke University School of Medicine (Dzirasa Lab).

---

## What It Does

NeuroTrace runs entirely in your browser. No Python, no Docker, no dependencies.

1. **Load** a multi-channel TIFF (DAPI + cFos) or standard image (PNG/JPEG)
2. **View** channels independently with adjustable color, brightness, and contrast
3. **Detect** cells using Gaussian denoising + Otsu thresholding + connected component segmentation
4. **Inspect** individual cells by clicking -- see centroid coordinates and area
5. **Export** results as CSV (cell ID, coordinates, area) or annotated PNG

---

## The Problem

cFos is an immediate early gene expressed in neurons within ~90 minutes of strong activation. Staining brain slices for cFos protein gives a spatial map of neural activity during a behavioral task. The standard quantification workflow is:

1. Acquire multi-channel fluorescence images (DAPI for all nuclei, GFP/RFP for cFos+ nuclei)
2. Open each image in QuPath or ImageJ
3. Manually count cFos+ cells per region, per slice, per animal
4. Copy counts into a spreadsheet

Step 3 is the bottleneck. It takes hours per animal, introduces subjective bias, and doesn't scale. NeuroTrace automates it.

---

## How Detection Works

The browser-based pipeline mirrors classical cell detection approaches:

**Gaussian Blur** (sigma = 1.0 default) -- Convolves the target channel with a Gaussian kernel using separable 2D convolution. Suppresses shot noise from the camera sensor without destroying cell boundaries. Adjustable via the sidebar.

**Thresholding** -- Either automatic (Otsu's method, which maximizes inter-class variance to find the optimal intensity cutoff) or manual slider control. Pixels above threshold are foreground; below are background.

**Connected Component Labeling** -- Union-find algorithm with path compression identifies contiguous foreground regions. Each connected region gets a unique integer label.

**Size Filtering** -- Rejects components smaller than `minArea` (noise) or larger than `maxArea` (artifacts, merged cells). Adjustable in the sidebar.

**Boundary Extraction** -- 4-connected neighbor comparison on the label mask produces single-pixel-wide outlines rendered as a red overlay.

---

## UI Overview

The interface follows a QuPath-inspired layout optimized for fluorescence image analysis:

| Area | Function |
|---|---|
| **Toolbar** | Open image, select tool (pan/zoom/inspect), reset view, export PNG/CSV |
| **Viewer** | Canvas-based image display with scroll-wheel zoom-to-cursor, drag panning, pixel-level intensity readout |
| **Sidebar: Channels** | Toggle channel visibility, pick display color, adjust brightness and contrast per channel |
| **Sidebar: Detection** | Select target channel, set Gaussian sigma, toggle auto/manual threshold, set area filters, run detection |
| **Sidebar: Results** | Cell count, average area, overlay opacity, selected cell details, scrollable cell list |
| **Status Bar** | Image dimensions, bit depth, channel count, cursor coordinates with per-channel intensity values |

---

## Repository Structure

```
neurotrace/
├── frontend/                    # Browser UI (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Toolbar.tsx      # Top toolbar with tools and export
│   │   │   ├── ImageViewer.tsx  # Pan/zoom canvas viewer
│   │   │   └── Sidebar.tsx      # Channels, detection, results panels
│   │   ├── lib/
│   │   │   ├── tiff-loader.ts   # Multi-channel TIFF parser (utif2)
│   │   │   ├── detection.ts     # Gaussian blur, Otsu, connected components
│   │   │   ├── renderer.ts      # Channel compositing and overlay rendering
│   │   │   └── export.ts        # CSV and PNG export
│   │   ├── types/index.ts       # TypeScript interfaces
│   │   ├── App.tsx              # Root component with state management
│   │   └── main.tsx             # Entry point
│   └── package.json
├── backend/
│   ├── pipeline.py              # Python CLI pipeline (Cellpose segmentation)
│   └── requirements.txt
├── data/sample/
│   └── test_slice.tif           # Synthetic 2-channel test image (512x512)
└── .github/workflows/
    └── deploy.yml               # GitHub Pages auto-deploy on push
```

---

## Development

```bash
# Frontend (browser UI)
cd frontend
npm install
npm run dev
# Opens at localhost:5173

# Backend (Python CLI -- requires Python 3.11+ and GPU recommended)
pip install -r backend/requirements.txt
python backend/pipeline.py data/sample/test_slice.tif
```

---

## Tech Stack

| Layer | Tools |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 |
| **Image I/O** | utif2 (TIFF decoding), Canvas API (rendering) |
| **Detection** | Custom JS: Gaussian blur, Otsu threshold, union-find CCL |
| **Icons** | lucide-react |
| **Backend** | Python, Cellpose (cyto3), scikit-image, tifffile, matplotlib |
| **Deployment** | GitHub Pages via GitHub Actions |

---

## Planned

- Atlas registration via brainreg -- map detected cells to Allen CCF brain regions
- Per-region quantification with CSV export (region name, cell count, density)
- Batch processing across multiple animals with group statistics
- Cellpose model integration via ONNX.js for deep learning segmentation in the browser

---

## Author

**Ilias Mahboub**
Molecular Biosciences -- Duke University / Duke Kunshan University
Research Trainee @ Dzirasa Lab (Duke SM) -- Yuan Lab (SJTU-SM) -- Remy Lab
[im132@duke.edu](mailto:im132@duke.edu)
