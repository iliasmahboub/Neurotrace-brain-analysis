# NeuroTrace V0
### Automated cFos+ Cell Detection in Fluorescence Brain Slices · Cellpose Segmentation · Multi-Channel TIFF

A reproducible cell detection pipeline for immunofluorescence brain slice images. Takes multi-channel TIFF acquisitions (DAPI + cFos), runs instance segmentation via Cellpose, and outputs annotated overlay figures with cell counts. Built for cFos immediate early gene mapping in mouse brain tissue.

I am developing this tool to support histological analysis in circuit neuroscience research, initially for cFos quantification workflows at Duke University School of Medicine (Dzirasa Lab). The long-term goal is a full pipeline from raw fluorescence images to atlas-registered, region-level cell counts with publication-ready figures - replacing the manual ImageJ/QuPath counting that most labs still do by hand.

---

## What Is cFos Mapping?

cFos is an immediate early gene whose protein product accumulates in neuronal nuclei within ~90 minutes of strong activation. By perfusing an animal after a behavioral task, slicing the brain, and staining for cFos (typically with a secondary antibody conjugated to a fluorophore), you get a snapshot of which neurons were active during that task.

The standard workflow: acquire multi-channel fluorescence images on a slide scanner or confocal, where one channel (405nm/DAPI) labels all nuclei and another channel (e.g., 488nm/GFP or 594nm/RFP) labels cFos+ nuclei specifically. Then count the cFos+ cells per brain region. The counting is the bottleneck - it's manual, slow, and subjective. This pipeline automates it.

### Why Cellpose?

Cellpose is a generalist deep learning model for cell segmentation trained on a large and diverse dataset of cell morphologies. The cyto3 model handles fluorescence microscopy well out of the box without requiring manual threshold tuning or watershed post-processing. It returns a label mask where each detected cell gets a unique integer ID, which gives you instance-level segmentation rather than just a binary foreground/background map.

---

## Analysis Pipeline

### Step 1 - Load and Normalize

Raw fluorescence images are 16-bit TIFFs (intensity values 0–65535). Multi-channel images are stored as shape `(C, H, W)` or `(H, W, C)` - the loader handles both. Each channel is cast to float64 and min-max normalized to [0, 1]. Normalization is required because Cellpose and scikit-image expect float input and behave unpredictably on raw 16-bit arrays.

### Step 2 - Gaussian Denoising

The cFos channel is smoothed with a Gaussian kernel (sigma = 1.0). Fluorescence images contain shot noise from the camera sensor. The Gaussian filter suppresses this high-frequency noise without destroying cell boundaries at sigma = 1. Higher sigma values blur small cells - kept conservative intentionally.

### Step 3 - Cellpose Segmentation

The smoothed cFos channel is passed to Cellpose (`CellposeModel`, default cyto3 weights). Cellpose estimates cell diameter automatically and returns an integer label mask. Cell count = number of unique non-zero labels in the mask.

### Step 4 - Overlay Figure

Cell boundaries are extracted from the label mask using `skimage.segmentation.find_boundaries` and drawn as a red overlay on the grayscale cFos channel. Output is a 150 DPI PNG.

---

## Repository Structure

```
neurotrace/
├── README.md
├── backend/
│   ├── pipeline.py            # full pipeline - load, detect, overlay
│   └── requirements.txt       # pip dependencies
└── data/
    └── sample/
        └── test_slice.tif     # synthetic 2-channel test image (512x512, DAPI + cFos)
```

---

## Usage

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Run on the sample image
python backend/pipeline.py data/sample/test_slice.tif

# Output: data/sample/output.png
# Terminal prints detected cell count
```

To specify a custom output path:

```bash
python backend/pipeline.py your_image.tif -o results/overlay.png
```

---

## Requirements

- Python 3.11+
- Cellpose, tifffile, scikit-image, numpy, matplotlib
- Full pinned versions in `backend/requirements.txt`
- GPU not required (runs on CPU, ~1–2 min per 512x512 image)

---

## Planned

- Atlas registration via brainreg - map detected cells to Allen CCF brain regions
- Per-region quantification with CSV export (region name, cell count, density)
- Batch processing across multiple animals with group statistics
- Web interface for upload and interactive atlas overlay

---

## Author

**Ilias Mahboub**
Molecular Biosciences · Duke University / Duke Kunshan University
Research Trainee @ Dzirasa Lab (Duke SM) · Yuan Lab (SJTU-SM) · Remy Lab
[im132@duke.edu](mailto:im132@duke.edu)
