"""Reporting helpers for atlas assignment outputs."""

from __future__ import annotations

from collections import defaultdict

from .contracts import RegionAssignmentRecord, RegionCountSummary


def summarize_region_assignments(
    assignments: list[RegionAssignmentRecord],
) -> list[RegionCountSummary]:
    """Aggregate assigned cells into per-image region counts."""
    grouped: dict[tuple[str, str, int, str, str], int] = defaultdict(int)
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
            region_id=region_id,
            region_acronym=region_acronym,
            region_name=region_name,
            cell_count=cell_count,
        )
        for (image_name, atlas_name, region_id, region_acronym, region_name), cell_count in grouped.items()
    ]
    summaries.sort(key=lambda item: (item.image_name, item.region_name, item.region_id))
    return summaries
