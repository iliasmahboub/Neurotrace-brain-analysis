from backend.modules.atlas import RegionAssignmentRecord, summarize_region_assignments


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

    summaries = summarize_region_assignments(assignments)

    assert len(summaries) == 1
    assert summaries[0].region_acronym == "ILA"
    assert summaries[0].cell_count == 2
