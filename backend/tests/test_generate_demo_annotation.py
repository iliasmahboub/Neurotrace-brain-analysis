from pathlib import Path

import tifffile


def test_generate_demo_annotation_script_writes_expected_file(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)

    from backend.generate_demo_annotation import main

    main()

    output_path = tmp_path / "docs" / "examples" / "demo_annotation.tif"
    assert output_path.exists()
    image = tifffile.imread(output_path)
    assert image.shape == (4, 4)
