"""Typed contracts for atlas registration inputs and outputs."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np


def _validate_finite(value: float, name: str) -> float:
    if not np.isfinite(value):
        raise ValueError(f"{name} must be finite, got {value!r}")
    return float(value)


@dataclass(frozen=True)
class AffineTransform2D:
    """Homogeneous 3x3 transform mapping image pixel coordinates into atlas space."""

    matrix: tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]
    source_space: str
    target_space: str

    def as_array(self) -> np.ndarray:
        array = np.asarray(self.matrix, dtype=np.float64)
        if array.shape != (3, 3):
            raise ValueError(f"affine transform must be 3x3, got {array.shape}")
        return array

    def apply(self, x: float, y: float) -> tuple[float, float]:
        point = np.array([_validate_finite(x, "x"), _validate_finite(y, "y"), 1.0], dtype=np.float64)
        mapped = self.as_array() @ point
        if mapped[2] == 0:
            raise ValueError("affine transform produced an invalid homogeneous coordinate")
        return float(mapped[0] / mapped[2]), float(mapped[1] / mapped[2])


@dataclass(frozen=True)
class AtlasRegistrationManifest:
    """Description of the files and transforms needed for region assignment."""

    image_name: str
    atlas_name: str
    atlas_resolution_um: float
    annotation_image_path: Path
    structures_csv_path: Path
    transform: AffineTransform2D
    slice_index: int | None = None
    hemisphere: str | None = None

    def __post_init__(self) -> None:
        if not self.image_name.strip():
            raise ValueError("image_name must not be empty")
        if not self.atlas_name.strip():
            raise ValueError("atlas_name must not be empty")
        if self.atlas_resolution_um <= 0:
            raise ValueError("atlas_resolution_um must be positive")
        if self.slice_index is not None and self.slice_index < 0:
            raise ValueError("slice_index must be non-negative when provided")
        if self.hemisphere is not None and self.hemisphere not in {"left", "right", "bilateral"}:
            raise ValueError("hemisphere must be one of: left, right, bilateral")


@dataclass(frozen=True)
class CellCoordinateRecord:
    """Detected cell in source image coordinates."""

    cell_id: int
    centroid_x_px: float
    centroid_y_px: float
    area_px: int
    mean_intensity: float

    def __post_init__(self) -> None:
        if self.cell_id <= 0:
            raise ValueError("cell_id must be positive")
        if self.area_px <= 0:
            raise ValueError("area_px must be positive")
        _validate_finite(self.centroid_x_px, "centroid_x_px")
        _validate_finite(self.centroid_y_px, "centroid_y_px")
        _validate_finite(self.mean_intensity, "mean_intensity")


@dataclass(frozen=True)
class AtlasRegion:
    """Atlas structure metadata used for reporting assignments."""

    region_id: int
    acronym: str
    name: str
    parent_region_id: int | None = None

    def __post_init__(self) -> None:
        if self.region_id <= 0:
            raise ValueError("region_id must be positive")
        if not self.acronym.strip():
            raise ValueError("acronym must not be empty")
        if not self.name.strip():
            raise ValueError("name must not be empty")


@dataclass(frozen=True)
class RegionAssignmentRecord:
    """Detected cell mapped into atlas coordinates and assigned to a region."""

    image_name: str
    atlas_name: str
    cell_id: int
    source_x_px: float
    source_y_px: float
    atlas_x_um: float
    atlas_y_um: float
    region_id: int | None
    region_acronym: str | None
    region_name: str | None
    assignment_status: str

    def __post_init__(self) -> None:
        if not self.image_name.strip():
            raise ValueError("image_name must not be empty")
        if not self.atlas_name.strip():
            raise ValueError("atlas_name must not be empty")
        if self.cell_id <= 0:
            raise ValueError("cell_id must be positive")
        if self.assignment_status not in {"assigned", "outside_atlas", "unknown_region"}:
            raise ValueError(
                "assignment_status must be one of: assigned, outside_atlas, unknown_region"
            )
        _validate_finite(self.source_x_px, "source_x_px")
        _validate_finite(self.source_y_px, "source_y_px")
        _validate_finite(self.atlas_x_um, "atlas_x_um")
        _validate_finite(self.atlas_y_um, "atlas_y_um")
