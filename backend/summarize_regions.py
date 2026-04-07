"""CLI for converting atlas assignments into per-region count summaries."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

try:
    from backend.modules.atlas import (
        load_annotation_image,
        load_registration_manifest,
        RegionAssignmentRecord,
        summarize_region_assignments,
        write_region_count_summary_csv,
    )
except ModuleNotFoundError:
    from modules.atlas import (
        load_annotation_image,
        load_registration_manifest,
        RegionAssignmentRecord,
        summarize_region_assignments,
        write_region_count_summary_csv,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Summarize atlas-assigned cells into per-region counts"
    )
    parser.add_argument("assignments_csv", help="path to the atlas assignments CSV")
    parser.add_argument("manifest_json", help="path to the atlas registration manifest JSON")
    parser.add_argument(
        "-o",
        "--output-csv",
        default=None,
        help="path to the region-count summary CSV output",
    )
    return parser


def read_region_assignments_csv(path: str | Path) -> list[RegionAssignmentRecord]:
    assignments: list[RegionAssignmentRecord] = []
    with Path(path).open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            assignments.append(
                RegionAssignmentRecord(
                    image_name=row["image_name"],
                    atlas_name=row["atlas_name"],
                    cell_id=int(row["cell_id"]),
                    source_x_px=float(row["source_x_px"]),
                    source_y_px=float(row["source_y_px"]),
                    atlas_x_um=float(row["atlas_x_um"]),
                    atlas_y_um=float(row["atlas_y_um"]),
                    region_id=int(row["region_id"]) if row["region_id"] else None,
                    region_acronym=row["region_acronym"] or None,
                    region_name=row["region_name"] or None,
                    assignment_status=row["assignment_status"],
                    region_boundary_distance_um=(
                        float(row["region_boundary_distance_um"])
                        if row.get("region_boundary_distance_um")
                        else None
                    ),
                    region_boundary_proximity=row.get("region_boundary_proximity") or None,
                )
            )
    return assignments


def default_output_path(assignments_csv: Path) -> Path:
    stem = assignments_csv.with_suffix("")
    return stem.parent / f"{stem.name}_summary.csv"


def main() -> None:
    args = build_parser().parse_args()
    assignments_path = Path(args.assignments_csv)
    assignments = read_region_assignments_csv(assignments_path)
    if not assignments:
        raise ValueError("assignments csv contained no rows")

    manifest = load_registration_manifest(args.manifest_json)
    annotation_image = load_annotation_image(manifest.annotation_image_path)
    summaries = summarize_region_assignments(
        assignments=assignments,
        manifest=manifest,
        annotation_image=annotation_image,
    )

    output_csv = Path(args.output_csv) if args.output_csv else default_output_path(assignments_path)
    write_region_count_summary_csv(summaries, output_csv)
    print(f"wrote {len(summaries)} region summaries to {output_csv}")


if __name__ == "__main__":
    main()
