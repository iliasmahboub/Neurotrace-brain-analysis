"""Affine registration helpers based on paired 2D landmarks."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from backend.modules.atlas import AffineTransform2D


@dataclass(frozen=True)
class LandmarkPair:
    source_x_px: float
    source_y_px: float
    atlas_x_px: float
    atlas_y_px: float
    label: str | None = None


@dataclass(frozen=True)
class LandmarkResidual:
    label: str | None
    source_x_px: float
    source_y_px: float
    atlas_x_px: float
    atlas_y_px: float
    predicted_atlas_x_px: float
    predicted_atlas_y_px: float
    residual_x_px: float
    residual_y_px: float
    residual_distance_px: float


def fit_affine_from_landmarks_csv(path: str | Path) -> list[LandmarkPair]:
    pairs: list[LandmarkPair] = []
    with Path(path).open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        required = {"source_x_px", "source_y_px", "atlas_x_px", "atlas_y_px"}
        if reader.fieldnames is None or not required.issubset(reader.fieldnames):
            raise ValueError(
                "landmarks csv must contain columns: source_x_px, source_y_px, atlas_x_px, atlas_y_px"
            )

        for row in reader:
            pairs.append(
                LandmarkPair(
                    source_x_px=float(row["source_x_px"]),
                    source_y_px=float(row["source_y_px"]),
                    atlas_x_px=float(row["atlas_x_px"]),
                    atlas_y_px=float(row["atlas_y_px"]),
                    label=row.get("label") or None,
                )
            )
    return pairs


def estimate_affine_transform_2d(
    landmarks: list[LandmarkPair],
    source_space: str = "image_px",
    target_space: str = "atlas_px",
) -> AffineTransform2D:
    if len(landmarks) < 3:
        raise ValueError("at least 3 landmark pairs are required to estimate an affine transform")

    design_rows: list[list[float]] = []
    targets: list[float] = []
    for pair in landmarks:
        design_rows.append([pair.source_x_px, pair.source_y_px, 1.0, 0.0, 0.0, 0.0])
        design_rows.append([0.0, 0.0, 0.0, pair.source_x_px, pair.source_y_px, 1.0])
        targets.append(pair.atlas_x_px)
        targets.append(pair.atlas_y_px)

    design = np.asarray(design_rows, dtype=np.float64)
    target = np.asarray(targets, dtype=np.float64)
    solution, residuals, rank, _singular_values = np.linalg.lstsq(design, target, rcond=None)
    if rank < 6:
        raise ValueError("landmark configuration is degenerate and cannot define a full affine transform")

    matrix = (
        (float(solution[0]), float(solution[1]), float(solution[2])),
        (float(solution[3]), float(solution[4]), float(solution[5])),
        (0.0, 0.0, 1.0),
    )
    _ = residuals  # retained for future QC extensions
    return AffineTransform2D(matrix=matrix, source_space=source_space, target_space=target_space)


def transform_rmse(landmarks: list[LandmarkPair], transform: AffineTransform2D) -> float:
    if not landmarks:
        raise ValueError("landmarks must not be empty")

    squared_errors: list[float] = []
    for pair in landmarks:
        predicted_x, predicted_y = transform.apply(pair.source_x_px, pair.source_y_px)
        squared_errors.append((predicted_x - pair.atlas_x_px) ** 2 + (predicted_y - pair.atlas_y_px) ** 2)

    return float(np.sqrt(sum(squared_errors) / len(squared_errors)))


def compute_landmark_residuals(
    landmarks: list[LandmarkPair],
    transform: AffineTransform2D,
) -> list[LandmarkResidual]:
    residuals: list[LandmarkResidual] = []
    for pair in landmarks:
        predicted_x, predicted_y = transform.apply(pair.source_x_px, pair.source_y_px)
        residual_x = predicted_x - pair.atlas_x_px
        residual_y = predicted_y - pair.atlas_y_px
        residuals.append(
            LandmarkResidual(
                label=pair.label,
                source_x_px=pair.source_x_px,
                source_y_px=pair.source_y_px,
                atlas_x_px=pair.atlas_x_px,
                atlas_y_px=pair.atlas_y_px,
                predicted_atlas_x_px=predicted_x,
                predicted_atlas_y_px=predicted_y,
                residual_x_px=residual_x,
                residual_y_px=residual_y,
                residual_distance_px=float(np.sqrt(residual_x ** 2 + residual_y ** 2)),
            )
        )
    return residuals


def write_landmark_residuals_csv(
    residuals: list[LandmarkResidual],
    path: str | Path,
) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "label",
                "source_x_px",
                "source_y_px",
                "atlas_x_px",
                "atlas_y_px",
                "predicted_atlas_x_px",
                "predicted_atlas_y_px",
                "residual_x_px",
                "residual_y_px",
                "residual_distance_px",
            ]
        )
        for item in residuals:
            writer.writerow(
                [
                    item.label or "",
                    round(item.source_x_px, 6),
                    round(item.source_y_px, 6),
                    round(item.atlas_x_px, 6),
                    round(item.atlas_y_px, 6),
                    round(item.predicted_atlas_x_px, 6),
                    round(item.predicted_atlas_y_px, 6),
                    round(item.residual_x_px, 6),
                    round(item.residual_y_px, 6),
                    round(item.residual_distance_px, 6),
                ]
            )
