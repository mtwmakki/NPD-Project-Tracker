# IML Container Viewer

A self-contained web app for showing customers what their label looks like on our
thin-wall containers — in 3D, in their own colours, with their own artwork — and
for handing them the correct flat label template afterwards.

It has no build step, no server-side code and no dependency on the NPD Project
Tracker. Everything it needs is in this folder.

---

## Running it

The page uses ES modules and `fetch`, so it has to be **served over HTTP** —
opening `index.html` straight off the disk will not work.

```bash
cd iml-viewer
npx http-server -p 8099 -s .      # or: python3 -m http.server 8099
# open http://127.0.0.1:8099/
```

To publish, copy this folder to any static host. On GitHub Pages, a repo
serving this folder at its root gives you a URL you can send to a customer.

---

## What it does

| | |
|---|---|
| **3D preview** | Turntable, orbit, studio lighting, PP-like clearcoat gloss, optional translucency for natural masterbatch. |
| **Label application** | Drag artwork onto the window. It is projected onto the container wall in real time. **The file never leaves the browser** — nothing is uploaded. |
| **Distortion warning** | On a tapered wall, a rectangular label physically cannot lie flat. The app says so, and quantifies it. |
| **Die-line export** | Downloads the true flat label template as a 1:1 SVG in millimetres, with cut, bleed and safe-area lines. |
| **Render export** | 3× resolution PNG with a transparent background, for quotations and presentations. |

---

## Adding a product

Everything the viewer knows lives in `catalog.json`. A product looks like this:

```jsonc
{
  "id": "TW-RT-500",
  "name": "500 ml Round Tub",
  "family": "round-tub",

  "model": "models/TW-RT-500.glb",   // real CAD — preferred
  "upAxis": "z",                     // optional: CAD systems often export Z-up
  "unitScale": 1,                    // optional: force a scale factor to reach mm

  "parametric": {                    // used only when "model" is null or fails
    "bottomDia": 82, "topDia": 96, "height": 80,
    "wall": 0.48, "baseFillet": 4.5,
    "rimWidth": 2.4, "rimThickness": 1.6
  },

  "label": {                         // the label band, in mm from the base
    "yBottom": 5, "yTop": 73,
    "wrapDeg": 360, "offsetDeg": 0, "overlap": 3
  },

  "specs": { "capacity": "500 ml", "material": "PP", "wallThickness": "0.48 mm" }
}
```

A SKU with a `model` is badged **CAD** in the catalogue list; one falling back to
`parametric` is badged **PARAM**, and the disclaimer at the bottom of the
inspector changes to match. Nobody can mistake a stand-in for the real part.

---

## Getting real CAD into the viewer

The viewer reads **glTF 2.0 binary (`.glb`)**. Mould CAD has to be converted once
per SKU. Recommended routes, best first:

### FreeCAD (free, offline, keeps the file in-house)
1. `File ▸ Open` your `.step` / `.stp`.
2. Select the solid, then `File ▸ Export` and choose **glTF (\*.glb)**.
3. Before exporting, set the tessellation in `Edit ▸ Preferences ▸ Import-Export ▸ glTF`
   — deviation **0.02 mm**, angular deviation **5°**.

### Native CAD export
Fusion 360, Creo and NX can write glTF/GLB directly. SolidWorks does it through
Visualize. Use these if you already have the licence — the tessellation is
usually cleaner.

### Blender (when you only have STL)
Export STL from CAD at a fine chord height, import into Blender, then
`File ▸ Export ▸ glTF 2.0 (.glb)`.

**Do not use free online STEP converters.** Mould geometry is confidential.

### What makes a good export

| | Target | Why |
|---|---|---|
| Triangle count | under ~200 k per part | Keeps a showroom tablet smooth. |
| Chord deviation | 0.02 mm | Coarser than this and the rim shows facets under gloss. |
| Units | millimetres | The viewer guesses, but being explicit avoids a 1000× surprise. |
| Orientation | container axis on **Z** or **Y**, base at the origin | Set `upAxis` to match; the viewer re-centres the rest. |
| Content | the container only | Delete the mould, core, runners and any assembly fixtures. |

Drop the `.glb` in `models/` and point the SKU's `model` at it. The viewer
normalises axis, units, centring and origin automatically, and bakes that
transform into the vertices so the label projection stays exact.

If a model fails to load, the viewer logs a warning, falls back to the
parametric stand-in and re-badges the SKU — it never shows a blank screen in
front of a customer.

---

## The label maths

This is the part that has to be right, because a wrong die-line becomes wasted
print film.

A container wall tapering from radius `r₁` to `r₂` over height `h` is a truncated
cone with slant `s = √((r₂−r₁)² + h²)`. Unrolled flat, its surface is **an
annular sector**, not a rectangle:

```
L(r) = r · s / |r₂ − r₁|        radius in the flat pattern
θ    = 2π · |r₂ − r₁| / s       sector angle
```

Worked on a 500 ml tub's nominal taper — Ø82 to Ø96 over a 68 mm band — that is
a **36.9° arc running from R400 mm to R469 mm**: the familiar banana shape of an
IML label. The check that it closes is `L · θ = 2πr` at both ends, and the smoke
test asserts exactly that to under 1e-9 mm.

The app does not use nominal numbers, though. It measures the actual outer
radius off the geometry at the top and bottom of the label band you have set, so
moving the band changes the die-line — which is correct, because it changes
where on the taper the label sits.

With no taper, `θ → 0` and the sector degenerates to a plain rectangle
`2πr × h`. The app detects this and switches to rectangle mode on its own.

The same numbers drive both the 3D preview and the exported SVG, so the mock-up
the customer approves and the template their designer prints from cannot
disagree.

### Why "Rectangle" vs "Die-line arc" matters

Customers almost always send flat rectangular artwork first. **Rectangle** mode
shows that file wrapped as-is, and reports how badly it will fit — a 500 ml tub's
circumference grows by roughly 40 mm across the label band. **Die-line arc** mode treats
the artwork as already cut to the arc, which is what actually goes on press.
Showing both, side by side, is usually what ends the argument.

---

## Verifying a change

```bash
npx http-server -p 8099 -s .        # in one shell
node tools/smoke.mjs                # in another (needs playwright)
```

The smoke test boots the page in headless Chromium and checks that it renders a
non-blank frame, that the flat-pattern maths closes to under 1e-9 mm, that the
label projection engages and visibly changes the render, that the die-line SVG
parses in both modes, and that every catalogue SKU loads.

---

## Known limits

- Parametric geometry is **representative, not certified**. Confirm every
  dimension against the released mould drawing before artwork goes to print.
- WebGL will not match KeyShot. It is built to beat a flat artwork PDF in a
  sales meeting, which it does comfortably.
- Translucency (natural masterbatch) is the most expensive effect on screen. On
  an older showroom tablet, pick a solid colour.
- Phase 1 covers **round tubs and cups**. Rectangular tubs need a different
  unwrap — the label runs across four faces and corner radii — and pails need
  handle geometry. Neither is wired up yet.
- Label artwork is projected onto the wall band only; lids and in-mould base
  labels are not modelled.

---

## Third-party

`vendor/three/` is [three.js](https://threejs.org) r169, MIT licensed (see
`vendor/three/LICENSE`), vendored rather than pulled from a CDN so the tool
still works in a meeting room with no usable network.
