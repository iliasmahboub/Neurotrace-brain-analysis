"""
NeuroTrace Pipeline — fluorescence brain slice analysis.

Takes a multi-channel TIFF (ch0=DAPI, ch1=cFos), detects cFos+ cells
using Cellpose, and saves an overlay figure.
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import tifffile
from skimage.filters import gaussian
from cellpose import models
import matplotlib.pyplot as plt


def load_and_normalize(tiff_path: str) -> tuple[np.ndarray, np.ndarray]:
    """Load a TIFF and return normalised DAPI (ch0) and cFos (ch1) channels."""
    img = tifffile.imread(tiff_path)
    # Handle shapes: (C, H, W) or (H, W, C) or (H, W)
    if img.ndim == 2:
        # Single-channel — treat as cFos, fabricate empty DAPI
        dapi = np.zeros_like(img, dtype=np.float64)
        cfos = img.astype(np.float64)
    elif img.ndim == 3:
        if img.shape[0] <= 4:  # (C, H, W)
            dapi = img[0].astype(np.float64)
            cfos = img[1].astype(np.float64) if img.shape[0] > 1 else img[0].astype(np.float64)
        else:  # (H, W, C)
            dapi = img[:, :, 0].astype(np.float64)
            cfos = img[:, :, 1].astype(np.float64) if img.shape[2] > 1 else img[:, :, 0].astype(np.float64)
    else:
        raise ValueError(f"Unexpected image shape: {img.shape}")

    # Normalize to 0-1
    def norm(a: np.ndarray) -> np.ndarray:
        mn, mx = a.min(), a.max()
        return (a - mn) / (mx - mn) if mx > mn else a

    return norm(dapi), norm(cfos)


def detect_cells(cfos: np.ndarray, sigma: float = 1.0) -> tuple[np.ndarray, int]:
    """Denoise the cFos channel and run Cellpose segmentation."""
    cfos_smooth = gaussian(cfos, sigma=sigma)
    model = models.CellposeModel(gpu=True)
    masks, flows, styles = model.eval(cfos_smooth, diameter=None)
    n_cells = masks.max()
    return masks, int(n_cells)


def save_overlay(cfos: np.ndarray, masks: np.ndarray, out_path: str) -> None:
    """Save a PNG showing cFos with red cell outlines."""
    from skimage.segmentation import find_boundaries

    boundaries = find_boundaries(masks, mode="outer")

    fig, ax = plt.subplots(figsize=(8, 8))
    ax.imshow(cfos, cmap="gray")
    # Overlay boundaries in red
    overlay = np.zeros((*cfos.shape, 4))
    overlay[boundaries] = [1, 0, 0, 1]
    ax.imshow(overlay)
    ax.set_axis_off()
    ax.set_title("cFos channel — detected cell outlines (red)")
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"Overlay saved to {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="NeuroTrace: cFos cell detection pipeline")
    parser.add_argument("image", help="Path to a multi-channel TIFF image")
    parser.add_argument(
        "-o", "--output",
        default=str(Path(__file__).resolve().parent.parent / "data" / "sample" / "output.png"),
        help="Path for the output PNG (default: data/sample/output.png)",
    )
    args = parser.parse_args()

    print(f"Loading image: {args.image}")
    dapi, cfos = load_and_normalize(args.image)
    print(f"Image shape: {cfos.shape}")

    print("Running Cellpose (cyto3) cell detection...")
    masks, n_cells = detect_cells(cfos)
    print(f"Cells detected: {n_cells}")

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    save_overlay(cfos, masks, args.output)
    print("Pipeline complete.")


if __name__ == "__main__":
    main()
