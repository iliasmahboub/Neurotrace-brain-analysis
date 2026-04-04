"""IO helpers for atlas registration workflows."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from .contracts import (
    AffineTransform2D,
    AtlasRegistrationManifest,
    CellCoordinateRecord,
    RegionCountSummary,
    RegionAssignmentRecord,
)


def load_registration_manifest(path: str | Path) -> AtlasRegistrationManifest:
    """Load an atlas registration manifest from JSON."""
    manifest_path = Path(path)
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))

    transform_payload = payload["transform"]
    transform = AffineTransform2D(
        matrix=tuple(tuple(float(value) for value in row) for row in transform_payload["matrix"]),
        source_space=str(transform_payload["source_space"]),
        target_space=str(transform_payload["target_space"]),
    )

    return AtlasRegistrationManifest(
        image_name=str(payload["image_name"]),
        atlas_name=str(payload["atlas_name"]),
        atlas_resolution_um=float(payload["atlas_resolution_um"]),
        annotation_image_path=Path(payload["annotation_image_path"]),
        structures_csv_path=Path(payload["structures_csv_path"]),
        transform=transform,
        slice_index=int(payload["slice_index"]) if payload.get("slice_index") is not None else None,
        hemisphere=str(payload["hemisphere"]) if payload.get("hemisphere") is not None else None,
    )


def read_detected_cells_csv(path: str | Path) -> list[CellCoordinateRecord]:
    """Read cell detections exported by the NeuroTrace pipeline."""
    records: list[CellCoordinateRecord] = []
    with Path(path).open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(row for row in handle if not row.startswith("#") and row.strip())
        for row in reader:
            records.append(
                CellCoordinateRecord(
                    cell_id=int(row["cell_id"]),
                    centroid_x_px=float(row["centroid_x_px"] if "centroid_x_px" in row else row["centroid_x"]),
                    centroid_y_px=float(row["centroid_y_px"] if "centroid_y_px" in row else row["centroid_y"]),
                    area_px=int(row["area_px"]),
                    mean_intensity=float(row["mean_intensity"]),
                )
            )
    return records


def write_region_assignments_csv(
    assignments: list[RegionAssignmentRecord],
    path: str | Path,
) -> None:
    """Write atlas region assignments for downstream quantification."""
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "image_name",
                "atlas_name",
                "cell_id",
                "source_x_px",
                "source_y_px",
                "atlas_x_um",
                "atlas_y_um",
                "region_id",
                "region_acronym",
                "region_name",
                "assignment_status",
            ]
        )
        for item in assignments:
            writer.writerow(
                [
                    item.image_name,
                    item.atlas_name,
                    item.cell_id,
                    round(item.source_x_px, 4),
                    round(item.source_y_px, 4),
                    round(item.atlas_x_um, 4),
                    round(item.atlas_y_um, 4),
                    item.region_id if item.region_id is not None else "",
                    item.region_acronym or "",
                    item.region_name or "",
                    item.assignment_status,
                ]
            )


def write_region_count_summary_csv(
    summaries: list[RegionCountSummary],
    path: str | Path,
) -> None:
    """Write per-image region counts for downstream statistics."""
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "image_name",
                "atlas_name",
                "region_id",
                "region_acronym",
                "region_name",
                "cell_count",
            ]
        )
        for item in summaries:
            writer.writerow(
                [
                    item.image_name,
                    item.atlas_name,
                    item.region_id,
                    item.region_acronym,
                    item.region_name,
                    item.cell_count,
                ]
            )
