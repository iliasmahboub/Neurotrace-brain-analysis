# Atlas Registration Workflow

This document defines the backend contract for atlas-aware NeuroTrace analysis. It does not assume a specific registration tool implementation yet. The immediate goal is to make future atlas work reproducible and inspectable instead of script-specific.

## Scope

Atlas registration work in this repo is split into four stages:

1. Detect cells in image pixel coordinates.
2. Register the slice into atlas space outside or inside NeuroTrace.
3. Transform detected cell centroids into atlas coordinates.
4. Assign transformed cells to atlas regions and export per-region summaries.

The current commit covers stage 2 input contracts and the output schema required for stages 3 and 4.

## Required Registration Manifest

Every registered slice should have a JSON manifest with:

- `image_name`: source image filename used for detection.
- `atlas_name`: atlas identifier, for example an Allen/BrainGlobe atlas name.
- `atlas_resolution_um`: atlas voxel or pixel resolution in micrometers for the 2D annotation plane.
- `annotation_image_path`: path to the 2D region-ID image used for assignment.
- `structures_csv_path`: path to a region metadata table containing IDs, acronyms, and names.
- `transform`: a 3x3 homogeneous affine matrix mapping image pixel coordinates into atlas coordinates.
- `slice_index`: optional atlas slice index.
- `hemisphere`: optional `left`, `right`, or `bilateral`.

The manifest loader is implemented in [backend/modules/atlas/io.py](/C:/Users/ilyas/neurotrace/backend/modules/atlas/io.py).

## Cell Input Contract

Atlas mapping expects detected cells in CSV form with these columns:

- `cell_id`
- `centroid_x_px` or `centroid_x`
- `centroid_y_px` or `centroid_y`
- `area_px`
- `mean_intensity`

This is intentionally compatible with current NeuroTrace exports while leaving room for standardized backend-only exports later.

## Region Assignment Output

Atlas-aware assignment output should contain:

- `image_name`
- `atlas_name`
- `cell_id`
- `source_x_px`
- `source_y_px`
- `atlas_x_um`
- `atlas_y_um`
- `region_id`
- `region_acronym`
- `region_name`
- `assignment_status`

`assignment_status` is constrained to:

- `assigned`
- `outside_atlas`
- `unknown_region`

## Engineering Rules

- Registration metadata must be explicit and file-backed. No hidden notebook state.
- Coordinate transforms must be versionable and inspectable.
- Atlas region IDs must remain numeric throughout the pipeline.
- Region acronyms and names are derived metadata, not primary keys.
- Future non-affine registrations should extend the manifest instead of replacing it with ad hoc formats.

## Next Steps

The next backend slices should be:

1. region table loading and validation
2. affine centroid mapping from image to atlas space
3. pixel lookup against annotation images
4. per-region aggregation exports
5. QC overlays for assignment failures
