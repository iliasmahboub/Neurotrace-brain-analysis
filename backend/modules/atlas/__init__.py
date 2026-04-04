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

__all__ = [
    "AffineTransform2D",
    "AtlasRegistrationManifest",
    "AtlasRegion",
    "CellCoordinateRecord",
    "RegionAssignmentRecord",
    "load_registration_manifest",
    "read_detected_cells_csv",
    "write_region_assignments_csv",
]
