import json

from pathlib import Path

from backend.modules.atlas import (
    AffineTransform2D,
    AtlasRegistrationManifest,
    RegionAssignmentQcSummary,
)
from backend.modules.atlas.io import (
    load_registration_manifest,
    validate_atlas_region_table,
    validate_manifest_assets,
    write_assignment_qc_summary_json,
)


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


def test_write_assignment_qc_summary_json_includes_derived_fractions(tmp_path: Path) -> None:
    output_path = tmp_path / "qc.json"
    write_assignment_qc_summary_json(
        RegionAssignmentQcSummary(
            image_name="slice_a.tif",
            atlas_name="allen_mouse_25um",
            total_cells=10,
            assigned_cells=7,
            unknown_region_cells=2,
            outside_atlas_cells=1,
            border_cells=3,
            near_border_cells=2,
            interior_cells=2,
        ),
        output_path,
    )

    payload = json.loads(output_path.read_text(encoding="utf-8"))

    assert payload["assigned_fraction"] == 0.7
    assert payload["border_fraction_within_assigned"] == 3 / 7


def test_validate_atlas_region_table_rejects_duplicate_ids(tmp_path: Path) -> None:
    structures = tmp_path / "structures.csv"
    structures.write_text(
        "id,acronym,name\n1,CTX,Cortex\n1,TH,Thalamus\n",
        encoding="utf-8",
    )

    try:
        validate_atlas_region_table(structures)
    except ValueError as exc:
        assert "duplicate region ID" in str(exc)
        return

    raise AssertionError("expected duplicate region IDs to fail validation")


def test_load_registration_manifest_resolves_relative_asset_paths(tmp_path: Path) -> None:
    annotation = tmp_path / "annotation.tif"
    structures = tmp_path / "structures.csv"
    manifest_path = tmp_path / "manifest.json"
    annotation.write_bytes(b"fake")
    structures.write_text("id,acronym,name\n1,CTX,Cortex\n", encoding="utf-8")
    manifest_path.write_text(
        json.dumps(
            {
                "image_name": "slice_a.tif",
                "atlas_name": "allen_mouse_25um",
                "atlas_resolution_um": 25.0,
                "annotation_image_path": "annotation.tif",
                "structures_csv_path": "structures.csv",
                "transform": {
                    "matrix": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
                    "source_space": "image_px",
                    "target_space": "atlas_px",
                },
            }
        ),
        encoding="utf-8",
    )

    manifest = load_registration_manifest(manifest_path)

    assert manifest.annotation_image_path == annotation.resolve()
    assert manifest.structures_csv_path == structures.resolve()
