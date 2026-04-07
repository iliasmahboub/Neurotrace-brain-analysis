from backend.fit_affine_registration import build_manifest_payload


def test_build_manifest_payload_includes_registration_qc() -> None:
    payload = build_manifest_payload(
        image_name="slice_a.tif",
        atlas_name="allen_mouse_25um",
        annotation_image_path="annotation.tif",
        structures_csv_path="structures.csv",
        atlas_resolution_um=25.0,
        transform_matrix=((1.0, 0.0, 10.0), (0.0, 1.0, 20.0), (0.0, 0.0, 1.0)),
        slice_index=9,
        hemisphere="left",
        registration_rmse_px=0.25,
        landmark_count=4,
    )

    assert payload["transform"]["matrix"][0][2] == 10.0
    assert payload["registration_qc"]["landmark_rmse_px"] == 0.25
    assert payload["registration_qc"]["landmark_count"] == 4
