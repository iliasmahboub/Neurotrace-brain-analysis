"""Create a starter atlas registration manifest for NeuroTrace."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create a starter NeuroTrace atlas registration manifest JSON"
    )
    parser.add_argument("image_name", help="source image filename used during detection")
    parser.add_argument("atlas_name", help="atlas identifier, for example allen_mouse_25um")
    parser.add_argument("annotation_image_path", help="path to the 2D atlas annotation image")
    parser.add_argument("structures_csv_path", help="path to the atlas structures CSV")
    parser.add_argument(
        "-o",
        "--output-json",
        required=True,
        help="path to write the registration manifest JSON",
    )
    parser.add_argument(
        "--atlas-resolution-um",
        type=float,
        default=25.0,
        help="atlas pixel resolution in micrometers",
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
    slice_index: int | None = None,
    hemisphere: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "image_name": image_name,
        "atlas_name": atlas_name,
        "atlas_resolution_um": atlas_resolution_um,
        "annotation_image_path": annotation_image_path,
        "structures_csv_path": structures_csv_path,
        "transform": {
            "matrix": [
                [1.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0],
            ],
            "source_space": "image_px",
            "target_space": "atlas_px",
        },
    }
    if slice_index is not None:
        payload["slice_index"] = slice_index
    if hemisphere is not None:
        payload["hemisphere"] = hemisphere
    return payload


def main() -> None:
    args = build_parser().parse_args()
    output_path = Path(args.output_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = build_manifest_payload(
        image_name=args.image_name,
        atlas_name=args.atlas_name,
        annotation_image_path=args.annotation_image_path,
        structures_csv_path=args.structures_csv_path,
        atlas_resolution_um=args.atlas_resolution_um,
        slice_index=args.slice_index,
        hemisphere=args.hemisphere,
    )
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"wrote starter manifest to {output_path}")


if __name__ == "__main__":
    main()
