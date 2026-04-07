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

## 2. Run Region Assignment

```bash
python backend/assign_regions.py path/to/detections.csv path/to/manifest.json
```

This writes four outputs:

- `*_regions.csv`: per-cell atlas assignments
- `*_regions_summary.csv`: per-slice leaf-region counts and densities
- `*_regions_hierarchy_summary.csv`: hierarchy-aware parent-region rollups
- `*_regions_qc.json`: assignment status fractions and boundary-risk counts

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

## Current Boundary

What NeuroTrace does today:

- explicit transform-based atlas assignment
- hierarchy-aware regional summaries
- QC summaries for assignment failures and border-adjacent cells
- cohort aggregation across animals and conditions

What NeuroTrace does not do yet:

- generate the slice registration itself
- provide atlas QC overlays in the browser
- estimate true registration uncertainty
- run built-in inferential statistics
