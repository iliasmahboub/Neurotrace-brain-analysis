from pathlib import Path

import numpy as np

from backend.modules.atlas import (
    AffineTransform2D,
    AtlasRegistrationManifest,
    RegionAssignmentRecord,
    summarize_assignment_qc,
    summarize_region_assignments,
)


def test_summarize_region_assignments_counts_only_assigned_cells() -> None:
    assignments = [
        RegionAssignmentRecord(
            image_name="slice_a.tif",
            atlas_name="allen_mouse_25um",
            cell_id=1,
            source_x_px=1.0,
            source_y_px=2.0,
            atlas_x_um=25.0,
            atlas_y_um=50.0,
            region_id=10,
            region_acronym="ILA",
            region_name="Infralimbic area",
            assignment_status="assigned",
        ),
        RegionAssignmentRecord(
            image_name="slice_a.tif",
            atlas_name="allen_mouse_25um",
            cell_id=2,
            source_x_px=3.0,
            source_y_px=4.0,
            atlas_x_um=75.0,
            atlas_y_um=100.0,
            region_id=10,
            region_acronym="ILA",
            region_name="Infralimbic area",
            assignment_status="assigned",
        ),
        RegionAssignmentRecord(
            image_name="slice_a.tif",
            atlas_name="allen_mouse_25um",
            cell_id=3,
            source_x_px=9.0,
            source_y_px=9.0,
            atlas_x_um=225.0,
            atlas_y_um=225.0,
            region_id=None,
            region_acronym=None,
            region_name=None,
            assignment_status="outside_atlas",
        ),
    ]

    manifest = AtlasRegistrationManifest(
        image_name="slice_a.tif",
        atlas_name="allen_mouse_25um",
        atlas_resolution_um=25.0,
        annotation_image_path=Path("annotation.tif"),
        structures_csv_path=Path("structures.csv"),
        slice_index=7,
        hemisphere="left",
        transform=AffineTransform2D(
            matrix=((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)),
            source_space="image_px",
            target_space="atlas_px",
        ),
    )
    annotation = np.array([[10, 10], [10, 10]], dtype=np.int32)

    summaries = summarize_region_assignments(assignments, manifest, annotation)

    assert len(summaries) == 1
    assert summaries[0].region_acronym == "ILA"
    assert summaries[0].cell_count == 2
    assert summaries[0].slice_index == 7
    assert summaries[0].hemisphere == "left"
    assert summaries[0].region_area_px == 4
    assert summaries[0].cell_density_per_mm2 is not None


def test_summarize_assignment_qc_counts_statuses_and_boundary_buckets() -> None:
    assignments = [
        RegionAssignmentRecord(
            image_name="slice_a.tif",
            atlas_name="allen_mouse_25um",
            cell_id=1,
            source_x_px=1.0,
            source_y_px=2.0,
            atlas_x_um=25.0,
            atlas_y_um=50.0,
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
            source_x_px=3.0,
            source_y_px=4.0,
            atlas_x_um=75.0,
            atlas_y_um=100.0,
            region_id=10,
            region_acronym="ILA",
            region_name="Infralimbic area",
            assignment_status="assigned",
            region_boundary_distance_um=60.0,
            region_boundary_proximity="near_border",
        ),
        RegionAssignmentRecord(
            image_name="slice_a.tif",
            atlas_name="allen_mouse_25um",
            cell_id=3,
            source_x_px=9.0,
            source_y_px=9.0,
            atlas_x_um=225.0,
            atlas_y_um=225.0,
            region_id=None,
            region_acronym=None,
            region_name=None,
            assignment_status="outside_atlas",
        ),
    ]

    summary = summarize_assignment_qc(assignments)

    assert summary.total_cells == 3
    assert summary.assigned_cells == 2
    assert summary.outside_atlas_cells == 1
    assert summary.border_cells == 1
    assert summary.near_border_cells == 1
    assert summary.interior_cells == 0
