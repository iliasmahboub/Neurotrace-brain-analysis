from pathlib import Path

from backend.batch_assign_regions import read_jobs_csv


def test_read_jobs_csv_requires_expected_columns(tmp_path: Path) -> None:
    jobs_path = tmp_path / "jobs.csv"
    jobs_path.write_text("detections_csv,manifest_json\nx.csv,y.json\n", encoding="utf-8")

    try:
        read_jobs_csv(jobs_path)
    except ValueError:
        return

    raise AssertionError("expected ValueError for missing batch job columns")


def test_read_jobs_csv_parses_valid_rows(tmp_path: Path) -> None:
    jobs_path = tmp_path / "jobs.csv"
    jobs_path.write_text(
        (
            "detections_csv,manifest_json,assignments_csv,summary_csv\n"
            "a.csv,a.json,a_regions.csv,a_summary.csv\n"
        ),
        encoding="utf-8",
    )

    rows = read_jobs_csv(jobs_path)

    assert len(rows) == 1
    assert rows[0]["assignments_csv"] == "a_regions.csv"
