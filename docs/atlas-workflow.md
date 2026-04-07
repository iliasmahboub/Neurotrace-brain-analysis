# Atlas Workflow

NeuroTrace can already perform atlas-aware assignment once you have a registered slice transform.

## What You Need

- a detections CSV exported by NeuroTrace
- a registration manifest JSON
- a 2D atlas annotation image containing integer region IDs
- a structures CSV containing region metadata

## 1. Create a Starter Manifest

Use the helper CLI to generate a valid manifest template:

```bash
python backend/create_registration_manifest.py slice_a.tif allen_mouse_25um path/to/annotation.tif path/to/structures.csv -o path/to/manifest.json
```

This writes an identity-transform template that you can replace with your actual slice-to-atlas transform.

## 1b. Fit an Affine Transform from Landmarks

If you have paired source and atlas landmarks, NeuroTrace can fit an affine transform directly:

```bash
python backend/fit_affine_registration.py path/to/landmarks.csv slice_a.tif allen_mouse_25um path/to/annotation.tif path/to/structures.csv -o path/to/manifest.json
```

Expected landmark columns:

- `source_x_px`
- `source_y_px`
- `atlas_x_px`
- `atlas_y_px`

The fitted manifest includes a `registration_qc` block with landmark count and landmark RMSE in atlas-pixel space.

The fitting command also writes a per-landmark residuals CSV by default:

- `*_landmark_residuals.csv`

You can turn the fitted manifest and residuals into a Markdown summary with:

```bash
python backend/report_registration_fit.py path/to/manifest.json path/to/manifest_landmark_residuals.csv
```

## 2. Run Region Assignment

```bash
python backend/assign_regions.py path/to/detections.csv path/to/manifest.json
```

This writes four outputs:

- `*_regions.csv`: per-cell atlas assignments
- `*_regions_summary.csv`: per-slice leaf-region counts and densities
- `*_regions_hierarchy_summary.csv`: hierarchy-aware parent-region rollups
- `*_regions_qc.json`: assignment status fractions and boundary-risk counts
- `*_regions_qc_overlay.png`: visual QC overlay for assigned and failed cells
- `*_regions_review.csv`: prioritized review queue for failed and border-adjacent cells

## Minimal Public Example

The repo includes a synthetic example bundle in [`docs/examples`](/C:/Users/ilyas/neurotrace/docs/examples):

- [`demo_registration_manifest.json`](/C:/Users/ilyas/neurotrace/docs/examples/demo_registration_manifest.json)
- [`demo_structures.csv`](/C:/Users/ilyas/neurotrace/docs/examples/demo_structures.csv)
- [`demo_detections.csv`](/C:/Users/ilyas/neurotrace/docs/examples/demo_detections.csv)

To complete the example, create a small integer-valued annotation TIFF at `docs/examples/demo_annotation.tif` or replace the manifest path with your own annotation file. The manifest and CSVs are valid examples of the expected contract even without private data.

You can generate the demo annotation file with:

```bash
python backend/generate_demo_annotation.py
```

## 3. Run Batch Assignment

```bash
python backend/batch_assign_regions.py docs/batch-atlas-jobs.csv
```

Each job writes:

- assignment CSV
- leaf summary CSV
- hierarchy summary CSV
- QC JSON

## 4. Aggregate Cohorts

```bash
python backend/aggregate_region_cohorts.py docs/cohort-jobs.csv
```

The cohort output includes:

- total cell counts
- mean counts per slice
- mean and median counts per animal
- mean density summaries
- variability estimates across animals

## 5. Review Outputs in the Frontend

The NeuroTrace frontend can import atlas outputs directly:

- QC JSON
- leaf summary CSV
- hierarchy summary CSV

Use `Import Atlas Outputs` in the toolbar to load those artifacts and inspect assignment quality and top regions in the sidebar.

## Current Boundary

What NeuroTrace does today:

- explicit transform-based atlas assignment
- hierarchy-aware regional summaries
- QC summaries for assignment failures and border-adjacent cells
- cohort aggregation across animals and conditions
- landmark-based affine registration fitting with provenance and residual reporting

What NeuroTrace does not do yet:

- generate the slice registration itself
- provide atlas QC overlays in the browser
- estimate true registration uncertainty
- run built-in inferential statistics
