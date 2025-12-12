3D Plane & Point Plotter (Front-end Only)

Overview
- Single-file web app in `index.html` using Three.js.
- Define versatile planes (3 points or normal+point), customize size, color, opacity, wireframe.
- Plot a point via sliders and visualize with a sphere + crosshair.
- Manage multiple planes, toggle visibility, remove, and save/load presets.

Quick Start
- Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari).
- If running locally with a simple server:

```bash
# Option 1: Python (if available)
python3 -m http.server 8000
# Then open http://localhost:8000/index.html

# Option 2: VS Code Live Server extension
# Install, then right-click index.html → "Open with Live Server"
```

Features
- Plane creation modes:
	- 3 Points: define P1, P2, P3 to orient the plane.
	- Normal + Point: define a normal vector and a point on the plane.
- Styling: color, opacity, wireframe toggle.
- Scene controls: grid size/divisions, axes visibility, dark/light background.
- Points: sliders for x/y/z, adjustable point size, color.
- Presets: copy planes as JSON to clipboard, paste to load later.

Notes
- The grid is oriented as XY with Z up (axes helper shows orientation).
- Preset loading recreates meshes from saved vertices; orientation may differ from original basis but shape is preserved.
# MathforDataFinal