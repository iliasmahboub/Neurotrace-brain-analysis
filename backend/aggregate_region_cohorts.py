"""Aggregate region summary CSVs into cohort-level tables."""

from __future__ import annotations

import argparse
import csv
import statistics
from collections import defaultdict
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Aggregate NeuroTrace region summary CSVs into cohort-level statistics"
    )
    parser.add_argument(
        "cohort_jobs_csv",
        help=(
            "CSV with columns: summary_csv, animal_id, condition, cohort_label. "
            "Each row points to a per-slice region summary CSV."
        ),
    )
    parser.add_argument(
        "-o",
        "--output-csv",
        default=None,
        help="path to the aggregated cohort output CSV",
    )
    return parser


def read_cohort_jobs_csv(path: str | Path) -> list[dict[str, str]]:
    with Path(path).open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        required = {"summary_csv", "animal_id", "condition", "cohort_label"}
        if reader.fieldnames is None or not required.issubset(reader.fieldnames):
            raise ValueError(
                "cohort jobs csv must contain columns: summary_csv, animal_id, condition, cohort_label"
            )
        return [dict(row) for row in reader]


def read_region_summary_csv(path: str | Path) -> list[dict[str, str]]:
    with Path(path).open("r", newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def aggregate_jobs(jobs: list[dict[str, str]]) -> list[dict[str, str | float | int]]:
    grouped: dict[tuple[str, str, str, str, str, str], dict[str, object]] = defaultdict(
        lambda: {
            "slice_count": 0,
            "animal_ids": set(),
            "total_cell_count": 0,
            "density_sum": 0.0,
            "density_count": 0,
            "animal_cell_counts": defaultdict(int),
            "animal_density_values": defaultdict(list),
        }
    )

    for job in jobs:
        rows = read_region_summary_csv(job["summary_csv"])
        for row in rows:
            key = (
                job["cohort_label"],
                job["condition"],
                row["atlas_name"],
                row["region_id"],
                row["region_acronym"],
                row["region_name"],
            )
            bucket = grouped[key]
            bucket["slice_count"] += 1
            animal_id = job["animal_id"]
            animal_ids = bucket["animal_ids"]
            assert isinstance(animal_ids, set)
            animal_ids.add(animal_id)
            bucket["total_cell_count"] += int(row["cell_count"])
            animal_cell_counts = bucket["animal_cell_counts"]
            assert isinstance(animal_cell_counts, defaultdict)
            animal_cell_counts[animal_id] += int(row["cell_count"])

            density_value = row.get("cell_density_per_mm2", "")
            if density_value:
                bucket["density_sum"] += float(density_value)
                bucket["density_count"] += 1
                animal_density_values = bucket["animal_density_values"]
                assert isinstance(animal_density_values, defaultdict)
                animal_density_values[animal_id].append(float(density_value))

    aggregated_rows: list[dict[str, str | float | int]] = []
    for key, bucket in grouped.items():
        cohort_label, condition, atlas_name, region_id, region_acronym, region_name = key
        density_count = int(bucket["density_count"])
        mean_density = (bucket["density_sum"] / density_count) if density_count > 0 else ""
        animal_ids = bucket["animal_ids"]
        animal_cell_counts = bucket["animal_cell_counts"]
        animal_density_values = bucket["animal_density_values"]
        assert isinstance(animal_ids, set)
        assert isinstance(animal_cell_counts, defaultdict)
        assert isinstance(animal_density_values, defaultdict)
        per_animal_cell_counts = list(animal_cell_counts.values())
        per_animal_mean_densities = [
            sum(values) / len(values)
            for values in animal_density_values.values()
            if len(values) > 0
        ]
        aggregated_rows.append(
            {
                "cohort_label": cohort_label,
                "condition": condition,
                "atlas_name": atlas_name,
                "region_id": region_id,
                "region_acronym": region_acronym,
                "region_name": region_name,
                "animal_count": len(animal_ids),
                "slice_count": int(bucket["slice_count"]),
                "total_cell_count": int(bucket["total_cell_count"]),
                "mean_cell_count_per_slice": int(bucket["total_cell_count"]) / int(bucket["slice_count"]),
                "mean_density_per_mm2": mean_density,
                "mean_cell_count_per_animal": _mean_or_blank(per_animal_cell_counts),
                "median_cell_count_per_animal": _median_or_blank(per_animal_cell_counts),
                "std_cell_count_per_animal": _std_or_blank(per_animal_cell_counts),
                "sem_cell_count_per_animal": _sem_or_blank(per_animal_cell_counts),
                "mean_density_per_animal_mm2": _mean_or_blank(per_animal_mean_densities),
                "median_density_per_animal_mm2": _median_or_blank(per_animal_mean_densities),
                "std_density_per_animal_mm2": _std_or_blank(per_animal_mean_densities),
                "sem_density_per_animal_mm2": _sem_or_blank(per_animal_mean_densities),
            }
        )

    aggregated_rows.sort(
        key=lambda row: (
            str(row["cohort_label"]),
            str(row["condition"]),
            str(row["region_name"]),
            int(str(row["region_id"])),
        )
    )
    return aggregated_rows


def write_aggregated_csv(rows: list[dict[str, str | float | int]], path: str | Path) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "cohort_label",
        "condition",
        "atlas_name",
        "region_id",
        "region_acronym",
        "region_name",
        "animal_count",
        "slice_count",
        "total_cell_count",
        "mean_cell_count_per_slice",
        "mean_density_per_mm2",
        "mean_cell_count_per_animal",
        "median_cell_count_per_animal",
        "std_cell_count_per_animal",
        "sem_cell_count_per_animal",
        "mean_density_per_animal_mm2",
        "median_density_per_animal_mm2",
        "std_density_per_animal_mm2",
        "sem_density_per_animal_mm2",
    ]

    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def default_output_path(cohort_jobs_csv: Path) -> Path:
    stem = cohort_jobs_csv.with_suffix("")
    return stem.parent / f"{stem.name}_aggregated.csv"


def main() -> None:
    args = build_parser().parse_args()
    jobs_path = Path(args.cohort_jobs_csv)
    jobs = read_cohort_jobs_csv(jobs_path)
    rows = aggregate_jobs(jobs)
    output_csv = Path(args.output_csv) if args.output_csv else default_output_path(jobs_path)
    write_aggregated_csv(rows, output_csv)
    print(f"wrote {len(rows)} cohort rows to {output_csv}")


def _mean_or_blank(values: list[float | int]) -> float | str:
    if not values:
        return ""
    return statistics.fmean(values)


def _median_or_blank(values: list[float | int]) -> float | str:
    if not values:
        return ""
    return float(statistics.median(values))


def _std_or_blank(values: list[float | int]) -> float | str:
    if len(values) < 2:
        return ""
    return float(statistics.stdev(values))


def _sem_or_blank(values: list[float | int]) -> float | str:
    if len(values) < 2:
        return ""
    return float(statistics.stdev(values) / (len(values) ** 0.5))


if __name__ == "__main__":
    main()
