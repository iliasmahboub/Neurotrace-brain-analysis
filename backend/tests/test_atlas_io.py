import json

from pathlib import Path

from backend.modules.atlas import (
    AffineTransform2D,
    AtlasRegistrationManifest,
    RegistrationProvenance,
    RegistrationQc,
    RegionAssignmentRecord,
    RegionAssignmentQcSummary,
)
from backend.modules.atlas.io import (
    load_registration_manifest,
    validate_atlas_region_table,
    validate_manifest_assets,
    write_assignment_qc_summary_json,
    write_assignment_review_csv,
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
                "registration_qc": {
                    "landmark_rmse_px": 0.4,
                    "landmark_count": 5,
                },
                "registration_provenance": {
                    "method": "landmark_affine_fit",
                    "source_file": "landmarks.csv",
                    "generated_by": "backend/fit_affine_registration.py",
                    "notes": "synthetic test",
                },
            }
        ),
        encoding="utf-8",
    )
    (tmp_path / "landmarks.csv").write_text(
        "source_x_px,source_y_px,atlas_x_px,atlas_y_px\n0,0,0,0\n1,0,1,0\n0,1,0,1\n",
        encoding="utf-8",
    )

    manifest = load_registration_manifest(manifest_path)

    assert manifest.annotation_image_path == annotation.resolve()
    assert manifest.structures_csv_path == structures.resolve()
    assert manifest.registration_qc == RegistrationQc(landmark_rmse_px=0.4, landmark_count=5)
    assert manifest.registration_provenance == RegistrationProvenance(
        method="landmark_affine_fit",
        source_file=(tmp_path / "landmarks.csv").resolve(),
        generated_by="backend/fit_affine_registration.py",
        notes="synthetic test",
    )


def test_write_assignment_review_csv_filters_to_actionable_rows(tmp_path: Path) -> None:
    output_path = tmp_path / "review.csv"
    write_assignment_review_csv(
        [
            RegionAssignmentRecord(
                image_name="slice_a.tif",
                atlas_name="allen_mouse_25um",
                cell_id=1,
                source_x_px=0.0,
                source_y_px=0.0,
                atlas_x_um=0.0,
                atlas_y_um=0.0,
                region_id=10,
                region_acronym="ILA",
                region_name="Infralimbic area",
                assignment_status="assigned",
                region_boundary_distance_um=10.0,
                region_boundary_proximity="border",
            ),
            RegionAssignmentRecord(
                image_name="slice_a.tif",
                atlas_name="allen_mouse_25um",
                cell_id=2,
                source_x_px=1.0,
                source_y_px=1.0,
                atlas_x_um=25.0,
                atlas_y_um=25.0,
                region_id=10,
                region_acronym="ILA",
                region_name="Infralimbic area",
                assignment_status="assigned",
                region_boundary_distance_um=120.0,
                region_boundary_proximity="interior",
            ),
            RegionAssignmentRecord(
                image_name="slice_a.tif",
                atlas_name="allen_mouse_25um",
                cell_id=3,
                source_x_px=2.0,
                source_y_px=2.0,
                atlas_x_um=50.0,
                atlas_y_um=50.0,
                region_id=None,
                region_acronym=None,
                region_name=None,
                assignment_status="outside_atlas",
            ),
        ],
        output_path,
    )

    rows = output_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(rows) == 3
    assert "medium" in rows[1]
    assert "critical" in rows[2]
