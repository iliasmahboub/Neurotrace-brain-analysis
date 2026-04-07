"""QC artifact generation for atlas assignment workflows."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from .contracts import RegionAssignmentRecord


STATUS_COLORS = {
    "assigned": "#00c853",
    "unknown_region": "#ff9100",
    "outside_atlas": "#ff1744",
}

PROXIMITY_EDGE_COLORS = {
    "border": "#ffffff",
    "near_border": "#ffd54f",
    "interior": "#1a1a1a",
}


def save_assignment_qc_overlay(
    annotation_image: np.ndarray,
    assignments: list[RegionAssignmentRecord],
    output_path: str | Path,
    title: str | None = None,
) -> None:
    """Render a QC overlay showing atlas regions and assignment outcomes."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    figure, axis = plt.subplots(figsize=(8, 8))
    axis.imshow(annotation_image, cmap="tab20", interpolation="nearest")

    grouped = {
        "assigned": [],
        "unknown_region": [],
        "outside_atlas": [],
    }
    for item in assignments:
        grouped[item.assignment_status].append(item)

    for status, items in grouped.items():
        if not items:
            continue

        x_values = [item.atlas_x_um for item in items]
        y_values = [item.atlas_y_um for item in items]
        edge_colors = [
            PROXIMITY_EDGE_COLORS.get(item.region_boundary_proximity or "interior", "#1a1a1a")
            for item in items
        ]
        axis.scatter(
            x_values,
            y_values,
            s=28,
            c=STATUS_COLORS[status],
            edgecolors=edge_colors,
            linewidths=0.8,
            label=f"{status} (n={len(items)})",
        )

    axis.set_xlabel("Atlas X (um)")
    axis.set_ylabel("Atlas Y (um)")
    axis.set_title(title or "Atlas assignment QC overlay")
    axis.legend(loc="upper right", frameon=True)
    figure.tight_layout()
    figure.savefig(output, dpi=180)
    plt.close(figure)
