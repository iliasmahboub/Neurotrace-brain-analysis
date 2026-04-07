from backend.create_registration_manifest import build_manifest_payload


def test_build_manifest_payload_uses_identity_transform_template() -> None:
    payload = build_manifest_payload(
        image_name="slice_a.tif",
        atlas_name="allen_mouse_25um",
        annotation_image_path="annotation.tif",
        structures_csv_path="structures.csv",
        atlas_resolution_um=25.0,
        slice_index=12,
        hemisphere="left",
    )

    assert payload["image_name"] == "slice_a.tif"
    assert payload["atlas_name"] == "allen_mouse_25um"
    assert payload["slice_index"] == 12
    assert payload["hemisphere"] == "left"
    assert payload["transform"] == {
        "matrix": [
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0],
        ],
        "source_space": "image_px",
        "target_space": "atlas_px",
    }
