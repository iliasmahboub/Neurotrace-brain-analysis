"""
NeuroTrace pipeline for fluorescence brain slice analysis.

Loads a TIFF, segments cFos-positive cells with Cellpose, writes an
annotated overlay, and exports per-cell quantification for downstream
analysis.
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import tifffile
from cellpose import models
from skimage.filters import gaussian
from skimage.measure import regionprops
from skimage.segmentation import find_boundaries


@dataclass(frozen=True)
class PipelineConfig:
    image_path: Path
    png_output: Path
    csv_output: Path
    sigma: float
    diameter: float | None
    model_type: str
    use_gpu: bool


def load_channels(tiff_path: Path) -> tuple[np.ndarray, np.ndarray]:
    """Load a TIFF and return normalized DAPI (ch0) and cFos (ch1) channels."""
    image = tifffile.imread(tiff_path)

    if image.ndim == 2:
        dapi = np.zeros_like(image, dtype=np.float64)
        cfos = image.astype(np.float64)
    elif image.ndim == 3:
        if image.shape[0] <= 4:
            dapi = image[0].astype(np.float64)
            cfos = (
                image[1].astype(np.float64)
                if image.shape[0] > 1
                else image[0].astype(np.float64)
            )
        else:
            dapi = image[:, :, 0].astype(np.float64)
            cfos = (
                image[:, :, 1].astype(np.float64)
                if image.shape[2] > 1
                else image[:, :, 0].astype(np.float64)
            )
    else:
        raise ValueError(f"unexpected image shape: {image.shape}")

    return normalize_channel(dapi), normalize_channel(cfos)


def normalize_channel(channel: np.ndarray) -> np.ndarray:
    """Normalize an image channel to [0, 1]."""
    min_value = float(channel.min())
    max_value = float(channel.max())
    if max_value <= min_value:
        return np.zeros_like(channel, dtype=np.float64)
    return (channel - min_value) / (max_value - min_value)


def detect_cells(
    cfos: np.ndarray,
    sigma: float,
    diameter: float | None,
    model_type: str,
    use_gpu: bool,
) -> np.ndarray:
    """Denoise the cFos channel and run Cellpose segmentation."""
    smoothed = gaussian(cfos, sigma=sigma, preserve_range=True)
    model = models.CellposeModel(gpu=use_gpu, model_type=model_type)
    masks, _, _ = model.eval(smoothed, diameter=diameter)
    return np.asarray(masks, dtype=np.int32)


def export_cell_metrics(masks: np.ndarray, cfos: np.ndarray, csv_path: Path) -> int:
    """Write per-cell area, centroid, and mean intensity to CSV."""
    properties = regionprops(masks, intensity_image=cfos)

    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["cell_id", "centroid_x_px", "centroid_y_px", "area_px", "mean_intensity"])

        for prop in properties:
            writer.writerow(
                [
                    prop.label,
                    round(float(prop.centroid[1]), 2),
                    round(float(prop.centroid[0]), 2),
                    int(prop.area),
                    round(float(prop.mean_intensity), 6),
                ]
            )

    return len(properties)


def save_overlay(cfos: np.ndarray, masks: np.ndarray, output_path: Path, title: str) -> None:
    """Save a PNG showing cFos with red cell outlines."""
    boundaries = find_boundaries(masks, mode="outer")

    figure, axis = plt.subplots(figsize=(8, 8))
    axis.imshow(cfos, cmap="gray")

    overlay = np.zeros((*cfos.shape, 4), dtype=np.float32)
    overlay[boundaries] = [1, 0, 0, 1]
    axis.imshow(overlay)
    axis.set_axis_off()
    axis.set_title(title)

    figure.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    figure.savefig(output_path, dpi=150)
    plt.close(figure)


def build_parser() -> argparse.ArgumentParser:
    project_root = Path(__file__).resolve().parent.parent
    default_stem = project_root / "data" / "sample" / "output"

    parser = argparse.ArgumentParser(
        description="NeuroTrace: cFos cell detection and quantification pipeline"
    )
    parser.add_argument("image", help="path to a TIFF image")
    parser.add_argument(
        "--output-png",
        default=str(default_stem.with_suffix(".png")),
        help="path for the annotated PNG output",
    )
    parser.add_argument(
        "--output-csv",
        default=str(default_stem.with_suffix(".csv")),
        help="path for the per-cell metrics CSV output",
    )
    parser.add_argument(
        "--sigma",
        type=float,
        default=1.0,
        help="gaussian smoothing sigma applied before segmentation",
    )
    parser.add_argument(
        "--diameter",
        type=float,
        default=None,
        help="expected cell diameter in pixels (default: Cellpose auto-estimate)",
    )
    parser.add_argument(
        "--model",
        default="cyto3",
        help="Cellpose model type to use",
    )
    parser.add_argument(
        "--cpu",
        action="store_true",
        help="force CPU inference even if a GPU is available",
    )
    return parser


def parse_args() -> PipelineConfig:
    args = build_parser().parse_args()
    return PipelineConfig(
        image_path=Path(args.image),
        png_output=Path(args.output_png),
        csv_output=Path(args.output_csv),
        sigma=args.sigma,
        diameter=args.diameter,
        model_type=args.model,
        use_gpu=not args.cpu,
    )


def main() -> None:
    config = parse_args()

    print(f"loading image: {config.image_path}")
    _, cfos = load_channels(config.image_path)
    print(f"loaded normalized cFos channel with shape {cfos.shape}")

    print(
        "running Cellpose "
        f"(model={config.model_type}, sigma={config.sigma}, gpu={config.use_gpu})"
    )
    masks = detect_cells(
        cfos=cfos,
        sigma=config.sigma,
        diameter=config.diameter,
        model_type=config.model_type,
        use_gpu=config.use_gpu,
    )

    cell_count = export_cell_metrics(masks, cfos, config.csv_output)
    print(f"wrote {cell_count} cell measurements to {config.csv_output}")

    save_overlay(
        cfos=cfos,
        masks=masks,
        output_path=config.png_output,
        title=f"cFos channel with detected cell outlines (n={cell_count})",
    )
    print(f"saved overlay to {config.png_output}")
    print("pipeline complete")


if __name__ == "__main__":
    main()
