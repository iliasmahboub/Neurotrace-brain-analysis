from pathlib import Path

from backend.modules.registration import (
    LandmarkPair,
    estimate_affine_transform_2d,
    fit_affine_from_landmarks_csv,
    transform_rmse,
)


def test_fit_affine_from_landmarks_csv_parses_rows(tmp_path: Path) -> None:
    csv_path = tmp_path / "landmarks.csv"
    csv_path.write_text(
        "source_x_px,source_y_px,atlas_x_px,atlas_y_px,label\n0,0,10,20,a\n1,0,11,20,b\n0,1,10,21,c\n",
        encoding="utf-8",
    )

    rows = fit_affine_from_landmarks_csv(csv_path)

    assert len(rows) == 3
    assert rows[0].label == "a"


def test_estimate_affine_transform_2d_recovers_translation() -> None:
    landmarks = [
        LandmarkPair(0.0, 0.0, 10.0, 20.0),
        LandmarkPair(1.0, 0.0, 11.0, 20.0),
        LandmarkPair(0.0, 1.0, 10.0, 21.0),
        LandmarkPair(2.0, 2.0, 12.0, 22.0),
    ]

    transform = estimate_affine_transform_2d(landmarks)
    mapped_x, mapped_y = transform.apply(3.0, 4.0)

    assert round(mapped_x, 4) == 13.0
    assert round(mapped_y, 4) == 24.0
    assert transform_rmse(landmarks, transform) < 1e-6


def test_estimate_affine_transform_2d_rejects_degenerate_landmarks() -> None:
    landmarks = [
        LandmarkPair(0.0, 0.0, 1.0, 1.0),
        LandmarkPair(1.0, 1.0, 2.0, 2.0),
        LandmarkPair(2.0, 2.0, 3.0, 3.0),
    ]

    try:
        estimate_affine_transform_2d(landmarks)
    except ValueError as exc:
        assert "degenerate" in str(exc)
        return

    raise AssertionError("expected degenerate landmarks to fail")
