# Contributing to Darksite

Thank you for helping make the night sky easier to read. Darksite is a small project with a simple build, so most contributions take minutes to set up. This guide covers how the project is put together, how to run it, and what we look for in a pull request.

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Ways to help

| You have… | Start here |
|---|---|
| Found something drawn in the wrong place, a wrong time, or a crash | Open a **Bug report** issue. Include your site, date and time, and the projection. |
| Spotted a wrong magnitude, distance or description | Open a **Data correction** issue and cite a source (SIMBAD, NED, a paper or a reputable catalogue). |
| An idea for a feature or a better visual | Open a **Feature request** first so we can agree on the approach before you write code. |
| Some time and want to code | Look for issues labelled `good first issue` or `help wanted`. |
| A translation, better descriptions or accessibility fixes | All welcome. Open an issue or go straight to a pull request for small changes. |

## How the project fits together

```
darksite/
├── src/
│   ├── template.html     page shell: markup, CSS design tokens, layout
│   └── app.js            the whole app: catalogue prep, projection, WebGL sky, 2D layers, panels, search
├── tools/
│   ├── fetch_data.sh     downloads the pinned source catalogues into vendor/
│   ├── build_data.py     turns vendor/ into build/skydata.js (stars, DSOs, Milky Way texture, art)
│   ├── assemble.py       inlines data + app into dist/darksite.html and dist/index.html
│   ├── smoke.js          headless browser test used by CI
│   └── screenshot.js     renders a view to shots/ for visual review
├── dist/                 the built, self-contained app (committed so it can be opened or hosted directly)
├── docs/images/          README illustrations
└── vendor/, build/       generated, git-ignored
```

### The rendering pipeline

Every object is stored as a J2000 unit vector. Each frame, Astronomy Engine supplies a rotation matrix from J2000 equatorial to the observer's horizon (precession, nutation and location included). A camera basis and one of three projections (fisheye, stereographic, gnomonic) then map the result to the screen.

The canvases are stacked bottom to top:

1. **WebGL sky** (`FS` shader): twilight and daylight gradient, airglow, light pollution, moonlight, zodiacal light, and the Milky Way texture sampled per pixel through the inverse projection.
2. **2D main layer** (`renderMain`): grid, reference circles, constellation art (affine-mapped triangle meshes), lines, deep-sky objects, stars, planets, the Moon and labels.
3. **2D twinkle layer**: stars below 30° altitude, redrawn every frame.
4. **WebGL ground**: the treeline silhouette (`prof()` in the shader, mirrored by `horizonProfile()` in JS).
5. **2D HUD**: cardinal points and the scale bar.

If WebGL 2 is missing, `fallbackSky` and `fallbackGround` take over for layers 1 and 4.

Labels go through `queueLabel` and are placed by priority with collision avoidance in `placeLabels`, so a new layer should queue its labels rather than draw text directly.

## Setting up

You need **Python 3.9+** with `numpy` and `Pillow`, **Node 18+**, and `curl`.

```bash
# fork https://github.com/TanmayCJ/Darksite-Planetarium on GitHub first, then:
git clone https://github.com/<your-username>/Darksite-Planetarium.git
cd Darksite-Planetarium
pip install numpy pillow
npm install            # Playwright, for the smoke test only
npx playwright install chromium
```

Build everything from source:

```bash
npm run build:all      # fetch catalogues → build data → assemble dist/
npm run serve          # http://localhost:8080
```

If you only touched `src/app.js` or `src/template.html`, you can skip the data steps:

```bash
npm run build && npm run serve
```

## Making a change

1. **Branch** from `main`: `git checkout -b fix/moon-terminator`.
2. **Edit** `src/` or `tools/`. Never hand-edit `dist/`; it is generated.
3. **Rebuild** with `npm run build`, and with `npm run build:data` too if you changed `tools/build_data.py`.
4. **Check** your work:
   ```bash
   npm run check          # syntax
   npm test               # headless smoke test
   node tools/screenshot.js horizon 1280 800 2026-08-12T22:00   # writes shots/horizon_1280.png
   ```
   For anything visual, look at the screenshot, and include before/after images in your pull request.
5. **Commit** the source changes **and** the regenerated `dist/` files together.
6. **Open a pull request** and fill in the template.

## Style

- **JavaScript:** plain ES2020 in one IIFE, no framework and no bundler. Match the surrounding code: two-space indent, single quotes, semicolons, short helper names inside hot loops. Comment the *why*, not the *what*.
- **Performance:** `renderMain` runs on every frame while time is playing. Avoid allocating in per-star loops (see the typed-array fast path in the `stars` layer), and keep new layers cheap or gate them by field of view.
- **Robustness:** wrap a new drawing layer in `layer('name', () => …)` and a new panel section in the `updatePanel` list, so one failure cannot blank the sky.
- **CSS:** use the tokens in `:root`. The app deliberately has a single dark theme, so don't add light-mode styles.
- **Copy:** plain, specific and short. Name things the way an observer would.
- **Astronomy:** if you change a formula, say in the PR where it comes from (Meeus, the Explanatory Supplement, a paper) and how you checked it, for example against Stellarium or JPL Horizons for a given date and site.

## Data changes

- Catalogue sources are pinned in `tools/fetch_data.sh`. To bump one, change the pin, rebuild, and explain what changed in the PR.
- Corrections to the hand-written Messier notes in `src/app.js` (`MNOTES`) need a citation in the PR description.
- New datasets must allow redistribution. Add them to [DATA_LICENSES.md](DATA_LICENSES.md) and to the credit block in `src/template.html`.

## Commit messages

Use the imperative mood and keep the subject under about 70 characters, for example `Fix Saturn ring front/back order when tilt is negative`. Reference issues with `Fixes #123`.

## Reporting security issues

Please don't open a public issue. Follow [SECURITY.md](SECURITY.md).

## Releasing (maintainers)

1. Update `CHANGELOG.md` and the version in `package.json`.
2. `npm run build:all && npm test`.
3. Tag `vX.Y.Z` and push. The Pages workflow publishes `dist/` automatically on `main`.

Clear skies, and thanks for contributing.
