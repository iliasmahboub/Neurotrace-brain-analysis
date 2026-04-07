# NeuroTrace

### cFos Quantification for Fluorescence Brain Slices

NeuroTrace is a neuroscience analysis repo aimed at reducing manual cFos counting from fluorescence brain slices. The current codebase has two working layers:

1. A browser UI for loading TIFFs, visualizing channels, running classical segmentation, and exporting results.
2. A Python CLI pipeline for Cellpose-based segmentation with per-cell CSV output and annotated overlays.

This is not yet an end-to-end atlas-aware production pipeline. The goal is to keep the implemented pieces clean, inspectable, and directly useful for slice-level quantification while registration and cohort analysis are still in progress.

Built for cFos quantification workflows in circuit neuroscience research.

**[Launch NeuroTrace](https://iliasmahboub.github.io/Neurotrace-brain-analysis/)**

---

## Current Scope

Implemented today:

- Load multi-channel TIFF, PNG, or JPEG images in the browser.
- View channels independently with per-channel visibility, color, brightness, and contrast controls.
- Run browser-side detection using Gaussian smoothing, thresholding, watershed or connected components, and area filtering.
- Inspect detected cells and export per-cell CSV plus annotated PNG.
- Run batch detection across multiple loaded images in the frontend.
- Run a backend Cellpose pipeline that exports both an overlay figure and per-cell measurements.
- Assign detected cells to atlas regions using an explicit registration manifest.
- Export per-slice leaf-region summaries, hierarchy-aware parent-region summaries, QC reports, review queues, and QC overlays.
- Aggregate cohort-level summaries across animals and conditions with animal-level descriptive statistics.
- Import atlas QC and summary outputs back into the frontend for review.

Not implemented yet:

- Native slice-to-atlas registration inside NeuroTrace.
- Atlas QC overlays and researcher-in-the-loop registration review.
- Uncertainty-aware assignment beyond border-distance heuristics.
- Built-in inferential statistics for condition comparisons.
- Validation benchmarks against expert annotations.

---

## Why This Exists

cFos is commonly used as a readout of neuronal activation after behavior, stimulation, or stress paradigms. In many labs, the practical workflow is still:

1. Acquire fluorescence images for DAPI and cFos channels.
2. Open slices one by one in QuPath or ImageJ.
3. Count cFos-positive nuclei manually or with semi-manual thresholding.
4. Transfer counts into spreadsheets for downstream analysis.

That approach is slow, hard to standardize, and vulnerable to drift across people and sessions. NeuroTrace is intended to make slice-level quantification faster, more reproducible, and easier to inspect.

---

## Detection Paths

### Frontend path

The browser implementation is optimized for interactive review:

- Gaussian smoothing to suppress shot noise.
- Otsu or manual thresholding.
- Optional watershed splitting for touching objects.
- Size filtering to remove obvious debris and merged components.
- Boundary extraction for visual overlays.

This path is useful for quick QC, parameter tuning, exploratory counting, and lightweight export.

### Backend path

The Python CLI uses Cellpose for stronger segmentation on cFos-positive objects and exports:

- Annotated overlay PNG.
- Per-cell CSV with centroid, area, and mean intensity.

This path is better suited for more serious offline quantification runs.

---

## Repository Structure

```text
neurotrace/
|-- frontend/                  # React + TypeScript browser application
|   |-- src/
|   |   |-- components/        # Toolbar, viewer, sidebar
|   |   |-- lib/               # TIFF loading, detection, rendering, export
|   |   `-- types/             # Shared frontend types
|   `-- package.json
|-- backend/
|   |-- pipeline.py            # Cellpose CLI pipeline
|   |-- assign_regions.py      # Atlas region assignment CLI
|   |-- batch_assign_regions.py
|   |-- aggregate_region_cohorts.py
|   |-- create_registration_manifest.py
|   `-- requirements.txt
|-- data/sample/
|   `-- test_slice.tif         # Sample input image
|-- docs/
|-- .github/workflows/
`-- README.md
```

---

## Development

```bash
# frontend
cd frontend
npm install
npm run dev

# backend
pip install -r backend/requirements.txt
python backend/pipeline.py data/sample/test_slice.tif --cpu
```

Atlas assignment and cohort-analysis usage is documented in [docs/atlas-workflow.md](/C:/Users/ilyas/neurotrace/docs/atlas-workflow.md).

Frontend stack:

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- geotiff
- lucide-react

Backend stack:

- Python
- Cellpose
- scikit-image
- tifffile
- matplotlib

---

## Roadmap

- Add validation against manually annotated ground-truth slices.
- Introduce region-aware quantification after registration is in place.
- Support batch summaries at the animal and condition level.
- Decide which parts stay browser-native versus move to a reproducible backend pipeline.

The standard for new work in this repo should be simple: no inflated claims, no placeholder architecture, and every added feature should improve real neuroscience usefulness.
