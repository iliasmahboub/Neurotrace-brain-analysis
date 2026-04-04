"""Batch atlas assignment runner for multiple detection CSVs and manifests."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

try:
    from backend.modules.atlas import (
        assign_cells_to_regions,
        load_annotation_image,
        load_atlas_regions_table,
        load_registration_manifest,
        read_detected_cells_csv,
        summarize_region_assignments,
        write_region_assignments_csv,
        write_region_count_summary_csv,
    )
except ModuleNotFoundError:
    from modules.atlas import (
        assign_cells_to_regions,
        load_annotation_image,
        load_atlas_regions_table,
        load_registration_manifest,
        read_detected_cells_csv,
        summarize_region_assignments,
        write_region_assignments_csv,
        write_region_count_summary_csv,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run atlas assignment across multiple NeuroTrace detection CSV files"
    )
    parser.add_argument(
        "jobs_csv",
        help="CSV describing batch jobs with columns: detections_csv, manifest_json, assignments_csv, summary_csv",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    jobs = read_jobs_csv(args.jobs_csv)
    completed = 0

    for job in jobs:
        manifest = load_registration_manifest(job["manifest_json"])
        annotation_image = load_annotation_image(manifest.annotation_image_path)
        atlas_regions = load_atlas_regions_table(manifest.structures_csv_path)
        cells = read_detected_cells_csv(job["detections_csv"])

        assignments = assign_cells_to_regions(
            cells=cells,
            manifest=manifest,
            annotation_image=annotation_image,
            atlas_regions=atlas_regions,
        )
        summaries = summarize_region_assignments(
            assignments=assignments,
            manifest=manifest,
            annotation_image=annotation_image,
        )

        write_region_assignments_csv(assignments, job["assignments_csv"])
        write_region_count_summary_csv(summaries, job["summary_csv"])
        completed += 1
        print(
            f"completed {completed}/{len(jobs)}: "
            f"{Path(job['detections_csv']).name} -> {Path(job['assignments_csv']).name}"
        )

    print(f"batch assignment complete: processed {completed} jobs")


def read_jobs_csv(path: str | Path) -> list[dict[str, str]]:
    with Path(path).open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        required = {"detections_csv", "manifest_json", "assignments_csv", "summary_csv"}
        if reader.fieldnames is None or not required.issubset(reader.fieldnames):
            raise ValueError(
                "jobs csv must contain columns: detections_csv, manifest_json, assignments_csv, summary_csv"
            )
        return [dict(row) for row in reader]


if __name__ == "__main__":
    main()
