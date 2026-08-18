# CAD models

Drop converted `.glb` files here, named after the SKU id, e.g. `TW-RT-500.glb`,
then point that product's `"model"` field in `../catalog.json` at it.

See "Getting real CAD into the viewer" in `../README.md` for the STEP → GLB
conversion route and the tessellation settings to use.

This folder is empty until the first mould CAD is converted. Every SKU in the
catalogue currently falls back to its parametric stand-in and is badged **PARAM**
in the app.
