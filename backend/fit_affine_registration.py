"""Fit an affine slice-to-atlas transform from paired landmarks."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from backend.modules.registration import (
    estimate_affine_transform_2d,
    fit_affine_from_landmarks_csv,
    transform_rmse,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Fit an affine atlas registration manifest from paired landmarks"
    )
    parser.add_argument("landmarks_csv", help="CSV with source_x_px, source_y_px, atlas_x_px, atlas_y_px")
    parser.add_argument("image_name", help="source image filename used during detection")
    parser.add_argument("atlas_name", help="atlas identifier")
    parser.add_argument("annotation_image_path", help="path to the 2D atlas annotation image")
    parser.add_argument("structures_csv_path", help="path to the atlas structures CSV")
    parser.add_argument(
        "-o",
        "--output-json",
        required=True,
        help="path to write the fitted registration manifest JSON",
    )
    parser.add_argument(
        "--atlas-resolution-um",
        type=float,
        default=25.0,
        help="atlas resolution in micrometers",
    )
    parser.add_argument(
        "--slice-index",
        type=int,
        default=None,
        help="optional slice index in atlas space",
    )
    parser.add_argument(
        "--hemisphere",
        choices=("left", "right", "bilateral"),
        default=None,
        help="optional hemisphere label",
    )
    return parser


def build_manifest_payload(
    image_name: str,
    atlas_name: str,
    annotation_image_path: str,
    structures_csv_path: str,
    atlas_resolution_um: float,
    transform_matrix: tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]],
    slice_index: int | None = None,
    hemisphere: str | None = None,
    registration_rmse_px: float | None = None,
    landmark_count: int | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "image_name": image_name,
        "atlas_name": atlas_name,
        "atlas_resolution_um": atlas_resolution_um,
        "annotation_image_path": annotation_image_path,
        "structures_csv_path": structures_csv_path,
        "transform": {
            "matrix": [[value for value in row] for row in transform_matrix],
            "source_space": "image_px",
            "target_space": "atlas_px",
        },
    }
    if slice_index is not None:
        payload["slice_index"] = slice_index
    if hemisphere is not None:
        payload["hemisphere"] = hemisphere
    if registration_rmse_px is not None or landmark_count is not None:
        payload["registration_qc"] = {}
        if registration_rmse_px is not None:
            payload["registration_qc"]["landmark_rmse_px"] = registration_rmse_px
        if landmark_count is not None:
            payload["registration_qc"]["landmark_count"] = landmark_count
    return payload


def main() -> None:
    args = build_parser().parse_args()
    landmarks = fit_affine_from_landmarks_csv(args.landmarks_csv)
    transform = estimate_affine_transform_2d(landmarks)
    rmse_px = transform_rmse(landmarks, transform)

    payload = build_manifest_payload(
        image_name=args.image_name,
        atlas_name=args.atlas_name,
        annotation_image_path=args.annotation_image_path,
        structures_csv_path=args.structures_csv_path,
        atlas_resolution_um=args.atlas_resolution_um,
        transform_matrix=transform.matrix,
        slice_index=args.slice_index,
        hemisphere=args.hemisphere,
        registration_rmse_px=rmse_px,
        landmark_count=len(landmarks),
    )

    output_path = Path(args.output_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"wrote affine registration manifest to {output_path}")
    print(f"landmark rmse: {rmse_px:.4f} px across {len(landmarks)} landmarks")


if __name__ == "__main__":
    main()
