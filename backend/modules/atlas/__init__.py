"""Atlas registration contracts and IO helpers for NeuroTrace."""

from .contracts import (
    AffineTransform2D,
    AtlasRegistrationManifest,
    AtlasRegion,
    CellCoordinateRecord,
    RegionHierarchyCountSummary,
    RegionAssignmentQcSummary,
    RegionCountSummary,
    RegionAssignmentRecord,
)
from .io import (
    load_registration_manifest,
    read_detected_cells_csv,
    write_assignment_qc_summary_json,
    write_region_count_summary_csv,
    write_region_hierarchy_summary_csv,
    write_region_assignments_csv,
)
from .mapper import (
    assign_cells_to_regions,
    classify_region_boundary_proximity,
    compute_region_boundary_distances,
    load_annotation_image,
    load_atlas_regions_table,
)
from .reporting import (
    summarize_assignment_qc,
    summarize_region_assignments,
    summarize_region_assignments_hierarchy,
)

__all__ = [
    "AffineTransform2D",
    "AtlasRegistrationManifest",
    "AtlasRegion",
    "CellCoordinateRecord",
    "RegionHierarchyCountSummary",
    "RegionAssignmentQcSummary",
    "RegionCountSummary",
    "RegionAssignmentRecord",
    "assign_cells_to_regions",
    "classify_region_boundary_proximity",
    "compute_region_boundary_distances",
    "load_annotation_image",
    "load_atlas_regions_table",
    "load_registration_manifest",
    "read_detected_cells_csv",
    "summarize_assignment_qc",
    "summarize_region_assignments",
    "summarize_region_assignments_hierarchy",
    "write_assignment_qc_summary_json",
    "write_region_count_summary_csv",
    "write_region_hierarchy_summary_csv",
    "write_region_assignments_csv",
]
