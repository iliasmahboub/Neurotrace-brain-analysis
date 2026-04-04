"""Atlas registration contracts and IO helpers for NeuroTrace."""

from .contracts import (
    AffineTransform2D,
    AtlasRegistrationManifest,
    AtlasRegion,
    CellCoordinateRecord,
    RegionAssignmentRecord,
)
from .io import (
    load_registration_manifest,
    read_detected_cells_csv,
    write_region_assignments_csv,
)
from .mapper import (
    assign_cells_to_regions,
    load_annotation_image,
    load_atlas_regions_table,
)

__all__ = [
    "AffineTransform2D",
    "AtlasRegistrationManifest",
    "AtlasRegion",
    "CellCoordinateRecord",
    "RegionAssignmentRecord",
    "assign_cells_to_regions",
    "load_annotation_image",
    "load_atlas_regions_table",
    "load_registration_manifest",
    "read_detected_cells_csv",
    "write_region_assignments_csv",
]
