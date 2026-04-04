from pathlib import Path

from backend.modules.atlas import AffineTransform2D, AtlasRegistrationManifest
from backend.modules.atlas.io import validate_manifest_assets


def test_validate_manifest_assets_accepts_existing_files(tmp_path: Path) -> None:
    annotation = tmp_path / "annotation.tif"
    structures = tmp_path / "structures.csv"
    annotation.write_bytes(b"fake")
    structures.write_text("id,acronym,name\n1,CTX,Cortex\n", encoding="utf-8")

    manifest = AtlasRegistrationManifest(
        image_name="slice_a.tif",
        atlas_name="allen_mouse_25um",
        atlas_resolution_um=25.0,
        annotation_image_path=Path("annotation.tif"),
        structures_csv_path=Path("structures.csv"),
        transform=AffineTransform2D(
            matrix=((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)),
            source_space="image_px",
            target_space="atlas_px",
        ),
    )

    validate_manifest_assets(manifest, tmp_path)


def test_validate_manifest_assets_rejects_missing_files(tmp_path: Path) -> None:
    manifest = AtlasRegistrationManifest(
        image_name="slice_a.tif",
        atlas_name="allen_mouse_25um",
        atlas_resolution_um=25.0,
        annotation_image_path=Path("missing_annotation.tif"),
        structures_csv_path=Path("missing_structures.csv"),
        transform=AffineTransform2D(
            matrix=((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)),
            source_space="image_px",
            target_space="atlas_px",
        ),
    )

    try:
        validate_manifest_assets(manifest, tmp_path)
    except FileNotFoundError:
        return

    raise AssertionError("expected FileNotFoundError for missing manifest assets")
