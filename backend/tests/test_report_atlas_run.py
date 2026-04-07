from backend.report_atlas_run import build_report


def test_build_report_includes_qc_and_top_regions() -> None:
    report = build_report(
        summary_rows=[
            {
                "region_name": "Infralimbic area",
                "region_acronym": "ILA",
                "cell_count": "7",
                "cell_density_per_mm2": "112.0",
            },
            {
                "region_name": "Prelimbic area",
                "region_acronym": "PL",
                "cell_count": "5",
                "cell_density_per_mm2": "80.0",
            },
        ],
        qc_payload={
            "image_name": "slice_a.tif",
            "atlas_name": "allen_mouse_25um",
            "total_cells": 10,
            "assigned_fraction": 0.7,
            "unknown_region_fraction": 0.2,
            "outside_atlas_fraction": 0.1,
            "border_fraction_within_assigned": 0.3,
        },
        top_n=1,
    )

    assert "# NeuroTrace Atlas Assignment Report" in report
    assert "Assigned fraction: `0.700`" in report
    assert "| Infralimbic area | ILA | 7 | 112.0 |" in report
