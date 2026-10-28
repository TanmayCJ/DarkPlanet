# Data and artwork licenses

Darksite's own code is MIT-licensed (see [LICENSE](LICENSE)). The built file `dist/darksite.html` also embeds data and artwork from the projects below. Each keeps its own license, and you must keep these notices when you redistribute the built file.

| What | Source | License | Pinned at |
|---|---|---|---|
| Stars to magnitude 8: positions, magnitudes, B−V colour, spectral types, distances, proper names | [HYG Database v3.8](https://github.com/astronexus/HYG-Database) by David Nash (Astronexus), derived from Hipparcos, Yale BSC and Gliese | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | commit `c7f7f88` |
| Milky Way outline, Messier and NGC/IC catalogue, deep-sky names, constellation lines, IAU boundaries, asterisms | [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn | [BSD 3-Clause](https://github.com/ofrohn/d3-celestial/blob/master/LICENSE) | npm `0.7.35` |
| Constellation illustrations and their anchor stars | [Stellarium](https://github.com/Stellarium/stellarium) “modern” sky culture, illustrations by Johan Meuris | [Free Art License 1.3](https://artlibre.org/licence/lal/en/) (data: CC BY-SA 4.0) | commit `898c360` |
| Sun, Moon, planet and Galilean-moon positions; rise/set, phases, eclipses | [Astronomy Engine](https://github.com/cosinekitty/astronomy) by Don Cross | [MIT](https://github.com/cosinekitty/astronomy/blob/master/LICENSE) | npm `2.1.19`, loaded from jsDelivr at runtime |
| Typefaces: IM Fell English, IBM Plex Sans Condensed, IBM Plex Mono | Google Fonts | [SIL Open Font License 1.1](https://openfontlicense.org) | loaded at runtime |

## What this means in practice

- **Share-alike data.** Because the star catalogue and Stellarium data are CC BY-SA 4.0, the *data portion* of `dist/darksite.html` is distributed under CC BY-SA 4.0. If you publish a modified catalogue, release it under the same license.
- **Attribution.** The app credits every source in its sidebar. Keep that credit block, or an equivalent one, in forks.
- **Hand-written reference text.** The Messier distances, position angles and one-line descriptions in `src/app.js` were written for this project from general astronomical knowledge. They are approximate and MIT-licensed with the code. Corrections with a cited source are very welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
