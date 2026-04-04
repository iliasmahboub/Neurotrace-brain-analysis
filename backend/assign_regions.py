"""CLI for assigning detected cells to atlas regions."""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

try:
    from backend.modules.atlas import (
        assign_cells_to_regions,
        load_annotation_image,
        load_atlas_regions_table,
        load_registration_manifest,
        read_detected_cells_csv,
        write_region_assignments_csv,
    )
except ModuleNotFoundError:
    from modules.atlas import (
        assign_cells_to_regions,
        load_annotation_image,
        load_atlas_regions_table,
        load_registration_manifest,
        read_detected_cells_csv,
        write_region_assignments_csv,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Assign NeuroTrace-detected cells to atlas regions using a registration manifest"
    )
    parser.add_argument("detections_csv", help="path to the per-cell detections CSV")
    parser.add_argument("manifest_json", help="path to the atlas registration manifest JSON")
    parser.add_argument(
        "-o",
        "--output-csv",
        default=None,
        help="path to the region-assignment CSV output",
    )
    return parser


def default_output_path(detections_csv: Path) -> Path:
    stem = detections_csv.with_suffix("")
    return stem.parent / f"{stem.name}_regions.csv"


def main() -> None:
    args = build_parser().parse_args()

    detections_path = Path(args.detections_csv)
    manifest = load_registration_manifest(args.manifest_json)
    annotation_image = load_annotation_image(manifest.annotation_image_path)
    atlas_regions = load_atlas_regions_table(manifest.structures_csv_path)
    cells = read_detected_cells_csv(detections_path)

    assignments = assign_cells_to_regions(
        cells=cells,
        manifest=manifest,
        annotation_image=annotation_image,
        atlas_regions=atlas_regions,
    )

    output_csv = Path(args.output_csv) if args.output_csv else default_output_path(detections_path)
    write_region_assignments_csv(assignments, output_csv)

    counts = Counter(item.assignment_status for item in assignments)
    print(f"wrote {len(assignments)} region assignments to {output_csv}")
    print(
        "assignment summary: "
        f"assigned={counts.get('assigned', 0)} "
        f"unknown_region={counts.get('unknown_region', 0)} "
        f"outside_atlas={counts.get('outside_atlas', 0)}"
    )


if __name__ == "__main__":
    main()
