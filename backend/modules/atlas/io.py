"""IO helpers for atlas registration workflows."""

from __future__ import annotations

import csv
import json
from dataclasses import asdict
from pathlib import Path

from .contracts import (
    AffineTransform2D,
    AtlasRegistrationManifest,
    CellCoordinateRecord,
    RegionAssignmentQcSummary,
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

    manifest = AtlasRegistrationManifest(
        image_name=str(payload["image_name"]),
        atlas_name=str(payload["atlas_name"]),
        atlas_resolution_um=float(payload["atlas_resolution_um"]),
        annotation_image_path=Path(payload["annotation_image_path"]),
        structures_csv_path=Path(payload["structures_csv_path"]),
        transform=transform,
        slice_index=int(payload["slice_index"]) if payload.get("slice_index") is not None else None,
        hemisphere=str(payload["hemisphere"]) if payload.get("hemisphere") is not None else None,
    )
    validate_manifest_assets(manifest, manifest_path.parent)
    return manifest


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
                "region_boundary_distance_um",
                "region_boundary_proximity",
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
                    round(item.region_boundary_distance_um, 6)
                    if item.region_boundary_distance_um is not None
                    else "",
                    item.region_boundary_proximity or "",
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
                "slice_index",
                "hemisphere",
                "region_id",
                "region_acronym",
                "region_name",
                "cell_count",
                "atlas_resolution_um",
                "pixel_area_um2",
                "region_area_px",
                "region_area_um2",
                "cell_density_per_mm2",
            ]
        )
        for item in summaries:
            writer.writerow(
                [
                    item.image_name,
                    item.atlas_name,
                    item.slice_index if item.slice_index is not None else "",
                    item.hemisphere or "",
                    item.region_id,
                    item.region_acronym,
                    item.region_name,
                    item.cell_count,
                    round(item.atlas_resolution_um, 6),
                    round(item.pixel_area_um2, 6),
                    item.region_area_px if item.region_area_px is not None else "",
                    round(item.region_area_um2, 6) if item.region_area_um2 is not None else "",
                    round(item.cell_density_per_mm2, 6) if item.cell_density_per_mm2 is not None else "",
                ]
            )


def write_assignment_qc_summary_json(
    summary: RegionAssignmentQcSummary,
    path: str | Path,
) -> None:
    """Write assignment QC summary as JSON for downstream reporting or dashboards."""
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = asdict(summary)
    payload["assigned_fraction"] = _safe_fraction(summary.assigned_cells, summary.total_cells)
    payload["unknown_region_fraction"] = _safe_fraction(summary.unknown_region_cells, summary.total_cells)
    payload["outside_atlas_fraction"] = _safe_fraction(summary.outside_atlas_cells, summary.total_cells)
    payload["border_fraction_within_assigned"] = _safe_fraction(summary.border_cells, summary.assigned_cells)
    payload["near_border_fraction_within_assigned"] = _safe_fraction(
        summary.near_border_cells,
        summary.assigned_cells,
    )
    payload["interior_fraction_within_assigned"] = _safe_fraction(summary.interior_cells, summary.assigned_cells)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def validate_manifest_assets(
    manifest: AtlasRegistrationManifest,
    relative_to: str | Path | None = None,
) -> None:
    """Validate that manifest asset references exist on disk."""
    base_path = Path(relative_to) if relative_to is not None else None
    annotation_path = _resolve_path(manifest.annotation_image_path, base_path)
    structures_path = _resolve_path(manifest.structures_csv_path, base_path)

    if not annotation_path.exists():
        raise FileNotFoundError(f"annotation image not found: {annotation_path}")
    if not structures_path.exists():
        raise FileNotFoundError(f"structures csv not found: {structures_path}")


def _resolve_path(path: Path, base_path: Path | None) -> Path:
    if path.is_absolute() or base_path is None:
        return path
    return (base_path / path).resolve()


def _safe_fraction(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator
