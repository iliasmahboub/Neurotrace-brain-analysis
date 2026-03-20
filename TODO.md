# NeuroTrace — TODO

## V0 — Remaining
- [ ] Run the pipeline on sample image and confirm output.png
- [ ] Test on a real fluorescence brain slice TIFF

## V1 — Next
- [ ] Modularize pipeline.py into separate modules (loader, preprocess, detect, register, quantify, visualize)
- [ ] Integrate brainreg for atlas registration
- [ ] Cell-to-region mapping via bg-atlasapi
- [ ] CSV export with per-region cell counts and density
