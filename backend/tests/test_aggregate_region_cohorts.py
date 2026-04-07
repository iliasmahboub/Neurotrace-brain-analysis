import csv
from pathlib import Path

from backend.aggregate_region_cohorts import aggregate_jobs, read_cohort_jobs_csv


def test_read_cohort_jobs_csv_requires_columns(tmp_path: Path) -> None:
    csv_path = tmp_path / "cohort_jobs.csv"
    csv_path.write_text("summary_csv,animal_id\nx.csv,a1\n", encoding="utf-8")

    try:
        read_cohort_jobs_csv(csv_path)
    except ValueError:
        return

    raise AssertionError("expected ValueError for missing cohort columns")


def test_aggregate_jobs_groups_region_rows(tmp_path: Path) -> None:
    summary_a = tmp_path / "summary_a.csv"
    summary_b = tmp_path / "summary_b.csv"

    fieldnames = [
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

    with summary_a.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(
            {
                "image_name": "slice1.tif",
                "atlas_name": "allen_mouse_25um",
                "slice_index": 1,
                "hemisphere": "left",
                "region_id": 10,
                "region_acronym": "ILA",
                "region_name": "Infralimbic area",
                "cell_count": 5,
                "atlas_resolution_um": 25,
                "pixel_area_um2": 625,
                "region_area_px": 100,
                "region_area_um2": 62500,
                "cell_density_per_mm2": 80.0,
            }
        )

    with summary_b.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(
            {
                "image_name": "slice2.tif",
                "atlas_name": "allen_mouse_25um",
                "slice_index": 2,
                "hemisphere": "left",
                "region_id": 10,
                "region_acronym": "ILA",
                "region_name": "Infralimbic area",
                "cell_count": 7,
                "atlas_resolution_um": 25,
                "pixel_area_um2": 625,
                "region_area_px": 100,
                "region_area_um2": 62500,
                "cell_density_per_mm2": 112.0,
            }
        )

    rows = aggregate_jobs(
        [
            {
                "summary_csv": str(summary_a),
                "animal_id": "mouse1",
                "condition": "stress",
                "cohort_label": "pilot",
            },
            {
                "summary_csv": str(summary_b),
                "animal_id": "mouse2",
                "condition": "stress",
                "cohort_label": "pilot",
            },
        ]
    )

    assert len(rows) == 1
    assert rows[0]["animal_count"] == 2
    assert rows[0]["slice_count"] == 2
    assert rows[0]["total_cell_count"] == 12
    assert rows[0]["mean_cell_count_per_animal"] == 6.0
    assert rows[0]["median_cell_count_per_animal"] == 6.0
    assert rows[0]["mean_density_per_animal_mm2"] == 96.0
