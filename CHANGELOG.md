# Changelog

All notable changes to Darksite are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] — 2026-10-28

First public release.

### Sky
- 41,487 stars to magnitude 8 from HYG 3.8, coloured by B−V, with airmass extinction and reddening near the horizon and twinkling below 30°.
- Fainter stars and deep-sky objects appear as you zoom, like moving from naked eye to binoculars to a telescope.
- Milky Way rendered per pixel in WebGL from d3-celestial contours, brightening toward Sagittarius and fading with moonlight, twilight and light pollution.
- Zodiacal light and gegenschein, airglow, a distant town glow and a Bortle 1–9 sky-quality setting.
- 88 constellations with Stellarium figure art, figure lines, Latin and IAU names, IAU boundaries and 42 asterisms.
- 110 Messier objects and about 1,000 NGC/IC/Caldwell objects and named dark nebulae, drawn at true angular size and orientation.
- Sun, Moon (phase, earthshine, true size), seven planets with phases, Jupiter's cloud bands, Saturn's rings at their real tilt, and Jupiter's four Galilean moons.
- Planet paths across the zodiac, the ecliptic, the celestial equator, an alt/az grid and meteor-shower radiants.
- Zenith (fisheye), Horizon (stereographic) and Optic (gnomonic, down to 5′) projections.

### Tonight ledger
- Darkness timeline with sunset, astronomical dusk and dawn, sunrise and moon-free hours.
- Moon phase and rise/set times, a planet table, "Best right now" targets and active meteor showers.
- Constellations rising and setting in the next two hours, and conjunction alerts.
- Seven-day events: Moon phases, perigee and apogee, oppositions, greatest elongations, eclipses, lunar occultations, conjunctions and meteor peaks.

### Interface
- Search across planets, stars, constellations, Messier and NGC objects, asterisms and showers, with an animated fly-to.
- Timeline with Sun and Moon altitude tracks, time scrubbing, playback speeds and a date picker.
- Hover readout, details card with rise/set times, selection reticle and keyboard shortcuts.
- Red night-vision mode, 4096 px PNG export, and a touch-friendly layout with a bottom sheet on phones.
- WebGL 2 fallback, recovery from lost graphics contexts, and per-layer error isolation.
