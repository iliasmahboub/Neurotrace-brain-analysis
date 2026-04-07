from pathlib import Path

import numpy as np

from backend.modules.atlas import RegionAssignmentRecord, save_assignment_qc_overlay


def test_save_assignment_qc_overlay_writes_png(tmp_path: Path) -> None:
    output_path = tmp_path / "qc_overlay.png"
    annotation = np.array([[10, 10], [10, 0]], dtype=np.int32)
    assignments = [
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
            region_boundary_distance_um=20.0,
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
            region_id=None,
            region_acronym=None,
            region_name=None,
            assignment_status="outside_atlas",
        ),
    ]

    save_assignment_qc_overlay(annotation, assignments, output_path)

    assert output_path.exists()
    assert output_path.stat().st_size > 0
