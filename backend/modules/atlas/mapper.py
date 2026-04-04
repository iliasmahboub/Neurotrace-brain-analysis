"""Atlas-space mapping and region assignment logic."""

from __future__ import annotations

import csv
from pathlib import Path

import numpy as np
import tifffile
from PIL import Image

from .contracts import (
    AtlasRegion,
    AtlasRegistrationManifest,
    CellCoordinateRecord,
    RegionAssignmentRecord,
)


def load_annotation_image(path: str | Path) -> np.ndarray:
    """Load a 2D atlas annotation image containing integer region IDs."""
    annotation_path = Path(path)
    if annotation_path.suffix.lower() in {".tif", ".tiff"}:
        image = tifffile.imread(annotation_path)
    else:
        image = np.asarray(Image.open(annotation_path))

    if image.ndim != 2:
        raise ValueError(f"annotation image must be 2D, got shape {image.shape}")
    if not np.issubdtype(image.dtype, np.integer):
        raise ValueError(f"annotation image must contain integer region IDs, got {image.dtype}")
    return image


def load_atlas_regions_table(path: str | Path) -> dict[int, AtlasRegion]:
    """Load atlas region metadata keyed by numeric region ID."""
    rows: dict[int, AtlasRegion] = {}
    with Path(path).open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            region_id = int(_first_present(row, "id", "region_id", "structure_id"))
            acronym = _first_present(row, "acronym", "region_acronym")
            name = _first_present(row, "name", "region_name", "safe_name")
            parent_value = row.get("parent_structure_id") or row.get("parent_region_id") or ""

            rows[region_id] = AtlasRegion(
                region_id=region_id,
                acronym=acronym,
                name=name,
                parent_region_id=int(parent_value) if parent_value else None,
            )
    return rows


def assign_cells_to_regions(
    cells: list[CellCoordinateRecord],
    manifest: AtlasRegistrationManifest,
    annotation_image: np.ndarray,
    atlas_regions: dict[int, AtlasRegion],
) -> list[RegionAssignmentRecord]:
    """Map detected cells into atlas space and assign each to a region."""
    assignments: list[RegionAssignmentRecord] = []

    image_height, image_width = annotation_image.shape
    for cell in cells:
        atlas_x_index, atlas_y_index = manifest.transform.apply(
            cell.centroid_x_px,
            cell.centroid_y_px,
        )
        atlas_x_um = atlas_x_index * manifest.atlas_resolution_um
        atlas_y_um = atlas_y_index * manifest.atlas_resolution_um

        lookup_x = int(round(atlas_x_index))
        lookup_y = int(round(atlas_y_index))
        if lookup_x < 0 or lookup_x >= image_width or lookup_y < 0 or lookup_y >= image_height:
            assignments.append(
                RegionAssignmentRecord(
                    image_name=manifest.image_name,
                    atlas_name=manifest.atlas_name,
                    cell_id=cell.cell_id,
                    source_x_px=cell.centroid_x_px,
                    source_y_px=cell.centroid_y_px,
                    atlas_x_um=atlas_x_um,
                    atlas_y_um=atlas_y_um,
                    region_id=None,
                    region_acronym=None,
                    region_name=None,
                    assignment_status="outside_atlas",
                )
            )
            continue

        region_id = int(annotation_image[lookup_y, lookup_x])
        region = atlas_regions.get(region_id)
        if region_id <= 0 or region is None:
            assignments.append(
                RegionAssignmentRecord(
                    image_name=manifest.image_name,
                    atlas_name=manifest.atlas_name,
                    cell_id=cell.cell_id,
                    source_x_px=cell.centroid_x_px,
                    source_y_px=cell.centroid_y_px,
                    atlas_x_um=atlas_x_um,
                    atlas_y_um=atlas_y_um,
                    region_id=region_id if region_id > 0 else None,
                    region_acronym=region.acronym if region else None,
                    region_name=region.name if region else None,
                    assignment_status="unknown_region",
                )
            )
            continue

        assignments.append(
            RegionAssignmentRecord(
                image_name=manifest.image_name,
                atlas_name=manifest.atlas_name,
                cell_id=cell.cell_id,
                source_x_px=cell.centroid_x_px,
                source_y_px=cell.centroid_y_px,
                atlas_x_um=atlas_x_um,
                atlas_y_um=atlas_y_um,
                region_id=region.region_id,
                region_acronym=region.acronym,
                region_name=region.name,
                assignment_status="assigned",
            )
        )

    return assignments


def _first_present(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and value != "":
            return value
    raise KeyError(f"expected one of {keys!r} in atlas region table")
