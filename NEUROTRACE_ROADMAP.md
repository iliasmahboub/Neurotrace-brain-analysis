# NeuroTrace — Full Development Roadmap

> A brain slice analysis pipeline: fluorescence images in, atlas-registered cell counts and publication-ready figures out.
> This document is the source of truth for every version. Each version builds directly on the last.

---

## The Big Picture

```
V0  →  V1  →  V2  →  V3  →  V4  →  V5
CLI    Local  Multi   Web    Cloud  Paper
script  GUI   animal  app    SaaS   ready
```

---

## V0 — Proof of Concept (CLI Script)

**Goal**: Prove the core pipeline works end-to-end on a single image from the command line.

**What it does**:
- Loads a 2-channel TIFF (DAPI + cFos)
- Preprocesses channels (normalize, denoise)
- Detects cFos+ cells with Cellpose
- Outputs an annotated PNG with cell outlines
- Prints cell count to terminal

**What it does NOT do**:
- No atlas registration yet
- No region-level quantification
- No UI of any kind

**File structure**:
```
neurotrace/
  backend/
    pipeline.py        ← the whole thing lives here
    requirements.txt
  data/
    sample/
      test_slice.tif
      output.png       ← generated
  README.md
```

**Tech stack**:
| Tool | Purpose |
|---|---|
| `tifffile` | Load TIFF images |
| `scikit-image` | Gaussian denoising, normalization |
| `Cellpose 3 (cyto3)` | Cell instance segmentation |
| `matplotlib` | Overlay cell outlines, save PNG |
| `argparse` | CLI argument parsing |
| `numpy` | Array operations |

**Key concepts to understand**:
- **16-bit images**: Fluorescence microscopes output 16-bit TIFFs (values 0–65535). You normalize to 0.0–1.0 float before any processing. If you skip this, Cellpose and scikit-image behave unpredictably.
- **Multichannel arrays**: A 2-channel image is stored as shape `(2, H, W)` or `(H, W, 2)`. You slice `image[0]` for DAPI, `image[1]` for cFos.
- **Gaussian denoising**: Convolves the image with a Gaussian kernel (bell curve shaped filter). Smooths out shot noise from the camera without destroying cell boundaries. `sigma=1` is conservative — higher sigma = more blur.
- **Cellpose cyto3**: Pre-trained model for cytoplasm segmentation. Returns a label matrix where each cell gets a unique integer ID (0 = background, 1 = cell 1, 2 = cell 2, etc.). Cell count = number of unique non-zero values.

**Done when**:
- `python pipeline.py --image data/sample/test_slice.tif` runs without errors
- `output.png` shows red outlines around detected cells
- Terminal prints a plausible cell count

---

## V1 — Atlas Registration + Quantification (Full Pipeline Script)

**Goal**: Map detected cells to brain regions. Output a CSV with per-region cell counts.

**What it adds over V0**:
- Atlas registration using `brainreg`
- Brain region lookup using `bg-atlasapi`
- Per-region cell count and density
- CSV export

**New file structure**:
```
neurotrace/
  backend/
    pipeline.py        ← updated
    modules/
      loader.py        ← image I/O
      preprocess.py    ← normalization, denoising
      detect.py        ← Cellpose wrapper
      register.py      ← brainreg wrapper
      quantify.py      ← cell-to-region mapping, CSV
      visualize.py     ← figure generation
    requirements.txt
  data/
    sample/
      test_slice.tif
      output.png
      results.csv      ← new
```

**Tech stack additions**:
| Tool | Purpose |
|---|---|
| `brainreg` | Register slice to Allen CCF atlas |
| `bg-atlasapi` | Query atlas region names, boundaries, areas |
| `pandas` | Build and export results DataFrame |

**Key concepts to understand**:

**Atlas registration — what's actually happening**:
brainreg solves an optimization problem: find the geometric transformation T that makes your image look as similar as possible to the atlas reference image.

1. **Similarity metric — Mutual Information (MI)**: Measures how much knowing the intensity at a pixel in image A tells you about the intensity at the same location in image B. Used instead of pixel-difference because your fluorescence image and the atlas have completely different intensity profiles (one is a stained slice, one is a annotated reference). MI is high when the two images share structural information regardless of absolute intensity values.

2. **Transform types**:
   - *Rigid*: rotation + translation only (6 degrees of freedom in 3D). Used for coarse alignment.
   - *Affine*: rigid + scaling + shearing (12 DOF). Gets you closer.
   - *Nonlinear (deformable)*: a vector displacement at every voxel — the image can stretch and warp locally. This is what handles the fact that your brain isn't shaped exactly like the atlas reference brain. Implemented as a B-spline deformation field.

3. **Optimizer — gradient descent**: At each step, compute the gradient of MI with respect to the transform parameters (how does MI change if I rotate slightly? translate slightly?). Take a small step in the direction that increases MI. Repeat until convergence. This is the same gradient descent that trains neural networks — same math, different objective.

4. **Output**: A transform file + a registered image. You apply the inverse transform to map image pixel coordinates → atlas voxel coordinates → region ID.

**Cell-to-region mapping**:
After registration, each pixel (x, y) in your image has a corresponding atlas voxel coordinate. You look up that voxel in the atlas annotation volume — a 3D array where each voxel value is a region ID integer. The region ID maps to a name ("CA1", "Prelimbic cortex", etc.) via the atlas structure tree. For each detected cell centroid, you do this lookup and increment that region's count.

**Density calculation**:
```
density (cells/mm²) = cell_count / region_area_in_slice
```
Region area comes from the atlas — you count how many atlas pixels fall within that region's boundary in your registered slice, then convert pixel count to mm² using the atlas resolution (typically 10 µm/voxel for Allen CCF → 0.01 mm/voxel → 0.0001 mm²/voxel²).

**Done when**:
- `python pipeline.py --image data/sample/test_slice.tif` produces `results.csv`
- CSV has columns: `region_id`, `region_name`, `cell_count`, `area_mm2`, `density_cells_per_mm2`
- Registration visually looks correct (atlas boundaries align with tissue boundaries)

---

## V2 — Batch Processing + Multi-Animal Aggregation

**Goal**: Process a folder of slices from multiple animals at once. Output group statistics.

**What it adds over V1**:
- Batch mode: process all TIFFs in a directory
- Per-animal results files
- Group aggregation: mean ± SEM per region across N animals
- Preliminary statistical comparison (t-test, ANOVA) between groups
- Config file instead of CLI flags

**New file structure**:
```
neurotrace/
  backend/
    modules/
      ... (same as V1)
      batch.py         ← new: orchestrates multi-animal runs
      stats.py         ← new: group aggregation, statistics
    config.json        ← new: pipeline parameters
  data/
    animal_01/
      slice_01.tif
      slice_02.tif
    animal_02/
      slice_01.tif
    results/
      animal_01_results.csv
      group_summary.csv   ← new
```

**Tech stack additions**:
| Tool | Purpose |
|---|---|
| `scipy.stats` | t-tests, one-way ANOVA |
| `json` | Config file parsing |
| `pathlib` | Directory traversal |
| `concurrent.futures` | Parallel processing across animals |

**Key concepts to understand**:

**Config-driven pipelines**: Instead of hardcoding `channel_0 = DAPI`, you read from `config.json`:
```json
{
  "channels": {
    "DAPI": 0,
    "cFos": 1
  },
  "cellpose_model": "cyto3",
  "atlas": "allen_mouse_10um",
  "cellpose_diameter": 15
}
```
This makes the tool usable by researchers with different microscope setups without touching code.

**Why multi-animal aggregation is hard** (and why people do it manually in Excel today):
Each animal's slice is at a slightly different AP coordinate (anterior-posterior position in the brain). Region A in animal 1's slice at AP -1.5mm might not be present in animal 2's slice at AP -1.7mm. You need to either: (a) normalize all animals to the same AP coordinate, or (b) average only the regions present across all animals. This is a real scientific decision you bake into the tool.

**Statistics — what the tool computes**:
- **Mean ± SEM**: Standard Error of the Mean = SD / √N. Tells you how confident you are in the group mean. This is what goes on bar charts in neuroscience papers (not SD).
- **Unpaired t-test**: Tests whether two group means are significantly different. Assumes normal distribution. p < 0.05 is the conventional threshold.
- **One-way ANOVA + Tukey post-hoc**: For 3+ groups. ANOVA tests whether any group differs; Tukey identifies which pairs differ.

**Done when**:
- `python pipeline.py --batch data/ --config config.json` processes all animals
- `group_summary.csv` has mean ± SEM per region
- Output includes p-values for pairwise comparisons

---

## V3 — Local Web App (FastAPI + Next.js)

**Goal**: Replace the CLI with a browser-based UI. Researchers use it without touching a terminal.

**What it adds over V2**:
- FastAPI REST backend with async job queue
- Next.js frontend with file upload, job status, results viewer
- Interactive slice viewer with atlas overlay
- Download buttons for figures and CSVs
- Docker Compose for one-command local deployment

**Architecture**:
```
Browser (localhost:3000)
    ↕ HTTP
Next.js Frontend
    ↕ REST API
FastAPI Backend (localhost:8000)
    ↕ Task queue
Celery Worker  ←→  Redis
    ↕
Pipeline modules (same as V1/V2)
```

**New file structure**:
```
neurotrace/
  backend/
    main.py            ← FastAPI app
    worker.py          ← Celery tasks
    modules/           ← same as before
  frontend/
    app/
      page.tsx         ← upload UI
      jobs/[id]/       ← results viewer
    components/
      SliceViewer.tsx  ← interactive image + atlas overlay
      RegionTable.tsx  ← sortable results table
  docker-compose.yml
  Dockerfile.backend
  Dockerfile.frontend
```

**Tech stack additions**:
| Tool | Purpose |
|---|---|
| `FastAPI` | REST API framework |
| `Celery` | Async task queue (pipeline jobs take minutes) |
| `Redis` | Message broker for Celery |
| `Next.js 14` | Frontend framework |
| `Konva.js` | Interactive canvas for slice viewer |
| `React Query` | Polling job status from frontend |
| `Docker Compose` | Package everything into one `docker-compose up` |

**Key concepts to understand**:

**Why async job queue**: Atlas registration takes 2–10 minutes. You can't block an HTTP request that long. Instead:
1. User uploads image → POST `/jobs` → returns `job_id` immediately
2. FastAPI pushes the job to Celery via Redis
3. Celery worker picks it up and runs the pipeline in the background
4. Frontend polls GET `/jobs/{id}/status` every 5 seconds
5. When status = "complete", frontend fetches results

**REST API design**:
```
POST   /jobs              → start pipeline job, returns {job_id}
GET    /jobs/{id}/status  → returns {status, progress, error}
GET    /jobs/{id}/results → returns {csv_url, figure_url, region_data}
GET    /jobs/{id}/figure  → returns annotated PNG
DELETE /jobs/{id}         → cleanup
```

**Interactive slice viewer**:
Konva.js renders the slice image on an HTML5 Canvas. Atlas region boundaries (SVG paths from bg-atlasapi) are drawn as a separate layer on top. The user can:
- Adjust opacity of the atlas overlay
- Click a region to highlight it and see its stats
- Toggle individual channels on/off

**Docker Compose**:
Three services in one file:
```yaml
services:
  frontend:   # Next.js, port 3000
  backend:    # FastAPI, port 8000
  redis:      # Redis, port 6379
  worker:     # Celery (same image as backend, different command)
```
Researcher runs `docker-compose up` and opens `localhost:3000`. No Python, no Node, no dependencies to install manually.

**Done when**:
- `docker-compose up` starts everything
- Researcher can upload a TIFF, watch a progress bar, see results in the browser
- Atlas overlay is interactive (click region = see stats)
- Download buttons work for PNG and CSV

---

## V4 — Advanced Features (Power User Layer)

**Goal**: Make NeuroTrace competitive with QuPath for power users. Add features researchers actually request.

**What it adds over V3**:
- Multi-channel support (beyond DAPI + cFos — any combination)
- Custom model fine-tuning UI (let researchers retrain Cellpose on their own cell type)
- Heatmap figures (brain-wide density maps, not just bar charts)
- 3D reconstruction from serial sections
- Bilateral analysis (left vs right hemisphere)
- Experiment management (save/reload pipeline configs, compare runs)

**Key new features**:

**Custom Cellpose fine-tuning**:
Cellpose cyto3 works well for most cells but fails on unusual morphologies (elongated axons, very small interneurons, packed granule cells). The tool lets users:
1. Upload 5–10 manually annotated images (draw cell outlines in a simple UI)
2. Click "Fine-tune model"
3. System runs `cellpose.train()` on those images starting from cyto3 weights (transfer learning)
4. New model is saved and selectable for future runs

Transfer learning concept: instead of training from random weights (takes thousands of images), you start from a model that already understands "cell-like shapes" and adjust it slightly for your specific cell type. 10–20 annotated images is often enough.

**Brain-wide heatmaps**:
Instead of a bar chart, generate a top-down or sagittal view of the whole brain colored by cFos density. Uses `brainglobe-heatmap` as a base but wrapped with:
- Custom color scales (viridis, hot, diverging for group comparisons)
- Bilateral display (left = group A, right = group B)
- Region hierarchy collapsing (show cortex as one color, or expand to sub-regions)

**3D reconstruction from serial sections**:
Stack registered 2D slices → interpolate between them → build a 3D volume. Visualize with `vedo` or export as `.nii` for use in other tools. Each slice needs to be at a known AP coordinate (from the registration).

**Done when**:
- Custom fine-tuning workflow works end-to-end
- Heatmap figures are publication-quality
- Serial section 3D viewer works in browser (Three.js)

---

## V5 — Cloud SaaS + Publication

**Goal**: Deploy publicly. Write the tool paper. Build the user base.

**What it adds over V4**:
- Cloud deployment (Vercel frontend, AWS/GCP backend with GPU instances)
- User accounts and project storage
- Public API for programmatic access
- Tool paper submission

**Deployment stack**:
| Component | Service |
|---|---|
| Frontend | Vercel |
| Backend API | AWS EC2 (GPU instance for Cellpose) |
| Storage | AWS S3 (images, results) |
| Database | PostgreSQL (RDS) |
| Auth | Clerk or Auth.js |
| Queue | AWS SQS instead of Redis |

**The tool paper**:

Target journals (in order of fit):
1. **eLife** (Tools and Resources) — open access, high visibility, explicitly wants better tooling
2. **Journal of Neuroscience Methods** — the standard venue for analysis tools
3. **Nature Methods** — if you have a strong methods contribution (the flow-field registration approach)

Paper structure:
- Introduction: why existing tools (QuPath + ABBA) are limited
- Implementation: pipeline architecture, each module
- Validation: compare cell counts to manual expert counts (ground truth). Show registration accuracy (Dice coefficient of region boundaries)
- Case study: run on a real cFos dataset (fear conditioning, novelty exposure, etc.)
- Availability: GitHub, Docker, web app URL

**Validation strategy** (what makes it publishable):
- Take 10 images, have an expert manually count cFos+ cells
- Run NeuroTrace on same images
- Report: correlation (r²), mean absolute error, processing time vs manual
- Registration accuracy: Dice similarity coefficient between auto-registered boundaries and expert-drawn boundaries. DSC > 0.85 is typically acceptable.

**Done when**:
- Public URL is live
- GitHub repo has 50+ stars
- Paper is submitted

---

## Cross-Version Learning Map

Each version requires understanding new concepts. Learn these in order as you reach each version:

| Version | What to learn | Resource |
|---|---|---|
| V0 | Numpy arrays, image bit depth, Cellpose API | Cellpose docs + readthedocs |
| V1 | Optimization, MI similarity, transform types, coordinate mapping | brainreg paper (Tyson 2022) |
| V2 | SEM vs SD, t-test, ANOVA, parallel processing | Any stats textbook intro chapter |
| V3 | REST APIs, async task queues, Docker, React state | FastAPI docs, Docker getting started |
| V4 | Transfer learning, CNN fine-tuning, 3D interpolation | Fast.ai course Ch. 1-5 |
| V5 | Cloud architecture, scientific writing, validation metrics | AWS docs, Nature Methods author guidelines |

---

## Dependency Map (what breaks if you skip a version)

```
V0 (detect cells)
 └─ V1 (register + quantify)          ← needs V0's detection output
     └─ V2 (batch + stats)            ← needs V1's per-animal CSV format
         └─ V3 (web UI)               ← needs V2's full pipeline as importable modules
             └─ V4 (power features)   ← needs V3's job queue architecture
                 └─ V5 (cloud)        ← needs V4's complete feature set
```

Do not skip versions. Each one locks in an architectural decision the next version depends on.

---

## Current Status

- [ ] V0 — CLI script
- [ ] V1 — Atlas registration + CSV
- [ ] V2 — Batch + multi-animal stats
- [ ] V3 — Local web app
- [ ] V4 — Power user features
- [ ] V5 — Cloud + paper

**Start here**: V0, Sprint 1 — run the Claude Code prompt in `backend/` to scaffold the project and get cells detected on a sample image.
