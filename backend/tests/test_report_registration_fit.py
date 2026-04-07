from backend.report_registration_fit import build_report


def test_build_report_includes_rmse_and_top_residuals() -> None:
    report = build_report(
        manifest_payload={
            "image_name": "slice_a.tif",
            "atlas_name": "allen_mouse_25um",
            "registration_qc": {
                "landmark_count": 4,
                "landmark_rmse_px": 0.25,
            },
            "registration_provenance": {
                "method": "landmark_affine_fit",
                "generated_by": "backend/fit_affine_registration.py",
                "notes": "manual matching",
            },
        },
        residual_rows=[
            {
                "label": "bregma",
                "residual_distance_px": "0.3",
                "residual_x_px": "0.1",
                "residual_y_px": "0.2",
            },
            {
                "label": "ventricle",
                "residual_distance_px": "0.1",
                "residual_x_px": "0.0",
                "residual_y_px": "0.1",
            },
        ],
    )

    assert "# NeuroTrace Registration Fit Report" in report
    assert "Landmark RMSE (px): `0.2500`" in report
    assert "| bregma | 0.3000 | 0.1000 | 0.2000 |" in report
