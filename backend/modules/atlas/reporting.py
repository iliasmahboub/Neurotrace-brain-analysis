"""Reporting helpers for atlas assignment outputs."""

from __future__ import annotations

from collections import Counter, defaultdict

import numpy as np

from .contracts import AtlasRegistrationManifest, RegionAssignmentRecord, RegionCountSummary


def summarize_region_assignments(
    assignments: list[RegionAssignmentRecord],
    manifest: AtlasRegistrationManifest,
    annotation_image: np.ndarray,
) -> list[RegionCountSummary]:
    """Aggregate assigned cells into per-image region counts."""
    grouped: dict[tuple[str, str, int, str, str], int] = defaultdict(int)
    region_areas = Counter(int(region_id) for region_id in annotation_image.flat if int(region_id) > 0)
    pixel_area_um2 = manifest.atlas_resolution_um * manifest.atlas_resolution_um

    for item in assignments:
        if item.assignment_status != "assigned":
            continue
        if item.region_id is None or item.region_acronym is None or item.region_name is None:
            continue

        key = (
            item.image_name,
            item.atlas_name,
            item.region_id,
            item.region_acronym,
            item.region_name,
        )
        grouped[key] += 1

    summaries = [
        RegionCountSummary(
            image_name=image_name,
            atlas_name=atlas_name,
            slice_index=manifest.slice_index,
            hemisphere=manifest.hemisphere,
            region_id=region_id,
            region_acronym=region_acronym,
            region_name=region_name,
            cell_count=cell_count,
            atlas_resolution_um=manifest.atlas_resolution_um,
            pixel_area_um2=pixel_area_um2,
            region_area_px=region_areas.get(region_id),
            region_area_um2=region_areas.get(region_id, 0) * pixel_area_um2,
            cell_density_per_mm2=_compute_density_per_mm2(
                cell_count=cell_count,
                region_area_px=region_areas.get(region_id),
                pixel_area_um2=pixel_area_um2,
            ),
        )
        for (image_name, atlas_name, region_id, region_acronym, region_name), cell_count in grouped.items()
    ]
    summaries.sort(key=lambda item: (item.image_name, item.region_name, item.region_id))
    return summaries


def _compute_density_per_mm2(
    cell_count: int,
    region_area_px: int | None,
    pixel_area_um2: float,
) -> float | None:
    if region_area_px is None or region_area_px <= 0:
        return None
    region_area_mm2 = (region_area_px * pixel_area_um2) / 1_000_000.0
    if region_area_mm2 <= 0:
        return None
    return cell_count / region_area_mm2
