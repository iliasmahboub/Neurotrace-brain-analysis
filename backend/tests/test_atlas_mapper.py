from pathlib import Path

import numpy as np

from backend.modules.atlas import (
    AffineTransform2D,
    AtlasRegistrationManifest,
    AtlasRegion,
    CellCoordinateRecord,
    assign_cells_to_regions,
)


def build_manifest() -> AtlasRegistrationManifest:
    return AtlasRegistrationManifest(
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


def test_assign_cells_to_regions_handles_core_statuses() -> None:
    annotation = np.array(
        [
            [1, 1, 0],
            [1, 2, 99],
            [0, 0, 0],
        ],
        dtype=np.int32,
    )
    atlas_regions = {
        1: AtlasRegion(region_id=1, acronym="CTX", name="Cortex"),
        2: AtlasRegion(region_id=2, acronym="STR", name="Striatum"),
    }
    cells = [
        CellCoordinateRecord(cell_id=1, centroid_x_px=0.1, centroid_y_px=0.1, area_px=10, mean_intensity=0.7),
        CellCoordinateRecord(cell_id=2, centroid_x_px=2.0, centroid_y_px=1.0, area_px=12, mean_intensity=0.8),
        CellCoordinateRecord(cell_id=3, centroid_x_px=6.0, centroid_y_px=6.0, area_px=9, mean_intensity=0.5),
    ]

    assignments = assign_cells_to_regions(
        cells=cells,
        manifest=build_manifest(),
        annotation_image=annotation,
        atlas_regions=atlas_regions,
    )

    assert [item.assignment_status for item in assignments] == [
        "assigned",
        "unknown_region",
        "outside_atlas",
    ]
    assert assignments[0].region_acronym == "CTX"
    assert assignments[1].region_id == 99
    assert assignments[2].region_id is None
