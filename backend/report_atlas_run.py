"""Generate a Markdown report from NeuroTrace atlas-assignment outputs."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a Markdown report from atlas assignment outputs"
    )
    parser.add_argument("summary_csv", help="path to the per-slice region summary CSV")
    parser.add_argument("qc_json", help="path to the assignment QC JSON")
    parser.add_argument(
        "-o",
        "--output-md",
        default=None,
        help="path to the Markdown report output",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=5,
        help="number of top regions to include by cell count",
    )
    return parser


def build_report(
    summary_rows: list[dict[str, str]],
    qc_payload: dict[str, object],
    top_n: int,
) -> str:
    top_rows = sorted(
        summary_rows,
        key=lambda row: int(row["cell_count"]),
        reverse=True,
    )[:top_n]

    lines = [
        "# NeuroTrace Atlas Assignment Report",
        "",
        "## QC Summary",
        "",
        f"- Image: `{qc_payload['image_name']}`",
        f"- Atlas: `{qc_payload['atlas_name']}`",
        f"- Total cells: `{qc_payload['total_cells']}`",
        f"- Assigned fraction: `{_format_fraction(qc_payload['assigned_fraction'])}`",
        f"- Unknown-region fraction: `{_format_fraction(qc_payload['unknown_region_fraction'])}`",
        f"- Outside-atlas fraction: `{_format_fraction(qc_payload['outside_atlas_fraction'])}`",
        f"- Border fraction within assigned cells: `{_format_fraction(qc_payload['border_fraction_within_assigned'])}`",
        "",
        "## Top Regions",
        "",
        "| Region | Acronym | Cell count | Density / mm2 |",
        "| --- | --- | ---: | ---: |",
    ]

    for row in top_rows:
        density = row["cell_density_per_mm2"] or ""
        lines.append(
            f"| {row['region_name']} | {row['region_acronym']} | {row['cell_count']} | {density} |"
        )

    return "\n".join(lines) + "\n"


def read_summary_csv(path: str | Path) -> list[dict[str, str]]:
    with Path(path).open("r", newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def read_qc_json(path: str | Path) -> dict[str, object]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def default_output_path(summary_csv: Path) -> Path:
    stem = summary_csv.with_suffix("")
    return stem.parent / f"{stem.name}_report.md"


def main() -> None:
    args = build_parser().parse_args()
    summary_csv = Path(args.summary_csv)
    summary_rows = read_summary_csv(summary_csv)
    qc_payload = read_qc_json(args.qc_json)
    output_md = Path(args.output_md) if args.output_md else default_output_path(summary_csv)
    output_md.write_text(build_report(summary_rows, qc_payload, args.top_n), encoding="utf-8")
    print(f"wrote atlas report to {output_md}")


def _format_fraction(value: object) -> str:
    if isinstance(value, (int, float)):
        return f"{float(value):.3f}"
    return str(value)


if __name__ == "__main__":
    main()
