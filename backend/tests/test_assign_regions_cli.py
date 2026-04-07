import csv
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import tifffile


def test_assign_regions_cli_writes_all_output_artifacts(tmp_path: Path) -> None:
    detections_csv = tmp_path / "detections.csv"
    manifest_json = tmp_path / "manifest.json"
    annotation_tif = tmp_path / "annotation.tif"
    structures_csv = tmp_path / "structures.csv"

    with detections_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["cell_id", "centroid_x_px", "centroid_y_px", "area_px", "mean_intensity"])
        writer.writerow([1, 0.0, 0.0, 12, 0.8])
        writer.writerow([2, 1.0, 1.0, 15, 0.9])

    tifffile.imwrite(annotation_tif, np.array([[10, 10], [10, 10]], dtype=np.int32))
    structures_csv.write_text(
        "id,acronym,name,parent_structure_id\n10,ILA,Infralimbic area,20\n20,mPFC,Medial prefrontal cortex,\n",
        encoding="utf-8",
    )
    manifest_json.write_text(
        json.dumps(
            {
                "image_name": "slice_a.tif",
                "atlas_name": "allen_mouse_25um",
                "atlas_resolution_um": 25.0,
                "annotation_image_path": str(annotation_tif),
                "structures_csv_path": str(structures_csv),
                "transform": {
                    "matrix": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
                    "source_space": "image_px",
                    "target_space": "atlas_px",
                },
            }
        ),
        encoding="utf-8",
    )

    output_csv = tmp_path / "detections_regions.csv"
    env = os.environ.copy()
    env["PYTHONPATH"] = "."

    completed = subprocess.run(
        [sys.executable, "backend/assign_regions.py", str(detections_csv), str(manifest_json), "-o", str(output_csv)],
        cwd=Path(__file__).resolve().parents[2],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert completed.returncode == 0, completed.stderr
    assert output_csv.exists()
    assert output_csv.with_name("detections_regions_summary.csv").exists()
    assert output_csv.with_name("detections_regions_hierarchy_summary.csv").exists()
    assert output_csv.with_name("detections_regions_qc.json").exists()
