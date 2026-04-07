"""Atlas registration contracts and IO helpers for NeuroTrace."""

from .contracts import (
    AffineTransform2D,
    AtlasRegistrationManifest,
    AtlasRegion,
    CellCoordinateRecord,
    RegionCountSummary,
    RegionAssignmentRecord,
)
from .io import (
    load_registration_manifest,
    read_detected_cells_csv,
    write_region_count_summary_csv,
    write_region_assignments_csv,
)
from .mapper import (
    assign_cells_to_regions,
    classify_region_boundary_proximity,
    compute_region_boundary_distances,
    load_annotation_image,
    load_atlas_regions_table,
)
from .reporting import summarize_region_assignments

__all__ = [
    "AffineTransform2D",
    "AtlasRegistrationManifest",
    "AtlasRegion",
    "CellCoordinateRecord",
    "RegionCountSummary",
    "RegionAssignmentRecord",
    "assign_cells_to_regions",
    "classify_region_boundary_proximity",
    "compute_region_boundary_distances",
    "load_annotation_image",
    "load_atlas_regions_table",
    "load_registration_manifest",
    "read_detected_cells_csv",
    "summarize_region_assignments",
    "write_region_count_summary_csv",
    "write_region_assignments_csv",
]
