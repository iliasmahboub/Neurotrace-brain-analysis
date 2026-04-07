"""Generate a tiny synthetic atlas annotation image for docs/examples."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import tifffile


def main() -> None:
    output_path = Path("docs/examples/demo_annotation.tif")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    annotation = np.array(
        [
            [10, 10, 11, 11],
            [10, 10, 11, 11],
            [10, 10, 11, 11],
            [0, 0, 0, 0],
        ],
        dtype=np.int32,
    )
    tifffile.imwrite(output_path, annotation)
    print(f"wrote demo annotation to {output_path}")


if __name__ == "__main__":
    main()
