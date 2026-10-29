/* Darksite Planetarium — real-time sky renderer.
 * Layers (bottom → top): WebGL sky (gradient, Milky Way, zodiacal light, moonlight) · 2D objects · 2D twinkling stars ·
 * WebGL ground silhouette · 2D HUD (cardinal points). All positions are J2000 unit vectors rotated to the local horizon
 * with Astronomy Engine's EQJ→HOR matrix, which includes precession, nutation and the observer's location.
 */
'use strict';
(function () {
const A = window.Astronomy;
const SD = window.SKYDATA;
const DEG = Math.PI / 180, RAD = 180 / Math.PI;
const DAY = 86400000, HOUR = 3600000, AU_KM = 149597870.7;
const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// ================================================================== reference text
const STAR_NOTES = {
  'Sirius': 'Brightest star in the night sky, a white star with a white-dwarf companion.',
  'Canopus': 'Second-brightest star; a luminous giant spacecraft use as a navigation reference.',
  'Arcturus': 'Brightest star north of the celestial equator, an orange giant cutting through the galactic disc.',
  'Rigil Kentaurus': 'Alpha Centauri A, part of the nearest star system to the Sun.',
  'Toliman': 'Alpha Centauri B, the orange companion in the nearest star system.',
  'Vega': 'Zero point of the magnitude scale and the pole star of 12,000 years from now.',
  'Capella': 'Two yellow giants orbiting each other every 104 days.',
  'Rigel': 'Blue supergiant some 100,000 times as luminous as the Sun.',
  'Procyon': 'Nearby yellow-white star with a white-dwarf companion.',
  'Achernar': 'The flattest known star, spinning so fast its equator bulges.',
  'Betelgeuse': 'Red supergiant near the end of its life; it dimmed dramatically in 2019–20.',
  'Hadar': 'Blue giant triple system marking the Centaur’s foreleg.',
  'Altair': 'Fast-spinning white star, visibly flattened by its 9-hour rotation.',
  'Acrux': 'Brightest star of the Southern Cross, a multiple system of hot blue stars.',
  'Aldebaran': 'Orange giant marking the Bull’s eye, in front of the Hyades cluster.',
  'Spica': 'Two hot blue stars orbiting each other every four days.',
  'Antares': 'Red supergiant whose name means “rival of Mars”.',
  'Pollux': 'Nearest giant star to the Sun, with a known giant planet.',
  'Fomalhaut': 'Young white star ringed by a dusty debris disc.',
  'Deneb': 'One of the most luminous stars visible to the naked eye, far beyond its Summer Triangle partners.',
  'Mimosa': 'Blue giant on the Southern Cross, a pulsating Beta Cephei variable.',
  'Regulus': 'Heart of the Lion, spinning close to break-up speed; it sits almost on the ecliptic.',
  'Castor': 'Looks like one star but is a six-star system.',
  'Shaula': 'The Scorpion’s stinger.',
  'Bellatrix': 'Blue giant marking Orion’s left shoulder.',
  'Elnath': 'Tip of the Bull’s northern horn, shared with Auriga.',
  'Alnilam': 'Middle star of Orion’s Belt, a blue supergiant.',
  'Alnitak': 'Easternmost belt star, beside the Flame and Horsehead nebulae.',
  'Mintaka': 'Westernmost belt star, almost exactly on the celestial equator.',
  'Polaris': 'The North Star, a Cepheid variable within a degree of the celestial pole.',
  'Mizar': 'Naked-eye double with Alcor; the first binary star seen in a telescope.',
  'Alcor': 'Mizar’s faint companion, a traditional eyesight test.',
  'Algol': 'The Demon Star: an eclipsing binary that fades for ten hours every 2.87 days.',
  'Mira': 'Long-period variable swinging from magnitude 2 to 10 over 332 days.',
  'Albireo': 'Gold-and-blue double star, a showpiece in any small telescope.',
  'Dubhe': 'Pointer star of the Big Dipper; follow Merak to Dubhe to reach Polaris.',
  'Merak': 'Pointer star of the Big Dipper.',
  'Thuban': 'Pole star of ancient Egypt around 2800 BC.',
  'Alpheratz': 'Corner of the Great Square of Pegasus, officially part of Andromeda.',
  'Mirfak': 'Brightest member of the Alpha Persei cluster, lovely in binoculars.',
  'Denebola': 'The Lion’s tail.',
  'Enif': 'The nose of Pegasus, an orange supergiant.',
  'Kochab': 'Guardian of the pole; it was the pole star around 1000 BC.',
  'Rasalhague': 'Head of the Serpent Bearer.',
  'Eltanin': 'Head of the Dragon; it passes through the zenith of London.',
  'Sadr': 'Centre of the Northern Cross, deep in the Milky Way.',
  'Gacrux': 'Red giant at the top of the Southern Cross, the nearest red giant to the Sun.',
  'Hamal': 'Brightest star of Aries; the March equinox lay nearby in antiquity.',
  'Alphard': 'The solitary one: the only bright star in the long Hydra.',
  'Diphda': 'Brightest star of Cetus, in a sparse region of sky.',
  'Schedar': 'Orange giant at the base of Cassiopeia’s W.',
  'Alkaid': 'End of the Big Dipper’s handle.',
  'Alioth': 'Brightest star of the Big Dipper.',
  'Kaus Australis': 'Brightest star of Sagittarius, the base of the Teapot.',
  'Algieba': 'Golden double star in the Lion’s mane.',
  'Adhara': 'The strongest source of extreme-ultraviolet light seen from Earth.',
};
const PLANET_NOTES = {
  Mercury: 'Smallest planet; never strays more than 28° from the Sun.',
  Venus: 'Brightest planet, wrapped in sulphuric-acid clouds; shows phases like the Moon.',
  Mars: 'The red planet; its colour comes from iron-oxide dust.',
  Jupiter: 'Largest planet; binoculars show its four Galilean moons.',
  Saturn: 'Ringed planet; the ring tilt toward Earth changes over its 29-year orbit.',
  Uranus: 'Ice giant at the edge of naked-eye visibility, tipped on its side.',
  Neptune: 'Outermost planet, always too faint for the naked eye; found by calculation in 1846.',
};
// Messier: [distance in light-years, position angle of major axis (deg), one-liner]. Approximate literature values.
const MNOTES = {
M1:[6500,125,'Supernova remnant of the explosion Chinese astronomers recorded in 1054.'],M2:[37500,0,'Rich globular cluster of about 150,000 stars.'],M3:[33900,0,'Globular cluster with an unusually large number of variable stars.'],M4:[7200,0,'One of the nearest globular clusters, just west of Antares.'],M5:[24500,0,'Globular cluster about 13 billion years old.'],M6:[1600,0,'Butterfly Cluster; its brightest star is an orange giant.'],M7:[980,0,'Ptolemy’s Cluster, noted around 130 AD; an easy naked-eye patch.'],M8:[4100,90,'Lagoon Nebula: a star-forming cloud split by a dark lane.'],M9:[25800,0,'Globular cluster near the galactic centre, dimmed by dust.'],M10:[14300,0,'Globular cluster in the heart of Ophiuchus.'],
M11:[6200,0,'Wild Duck Cluster, one of the richest compact open clusters.'],M12:[15700,0,'Loosely packed globular cluster, neighbour of M10.'],M13:[22200,0,'Great Hercules Cluster, ~300,000 stars; target of the 1974 Arecibo message.'],M14:[30300,0,'Globular cluster that hosted a nova in 1938.'],M15:[33600,0,'Dense core-collapsed globular cluster with a planetary nebula inside.'],M16:[7000,0,'Eagle Nebula, home of the Pillars of Creation.'],M17:[5500,120,'Omega or Swan Nebula, one of the brightest star-forming regions.'],M18:[4900,0,'Small, sparse open cluster between M17 and M24.'],M19:[28700,0,'One of the most flattened globular clusters known.'],M20:[5200,0,'Trifid Nebula: emission, reflection and dark nebula in one field.'],
M21:[4250,0,'Young open cluster beside the Trifid Nebula.'],M22:[10600,0,'Bright globular cluster, one of the first discovered (1665).'],M23:[2150,0,'Open cluster of about 150 stars.'],M24:[10000,0,'Sagittarius Star Cloud: a window through the dust into an inner spiral arm.'],M25:[2000,0,'Bright open cluster containing the Cepheid U Sagittarii.'],M26:[5000,0,'Compact open cluster in Scutum.'],M27:[1360,30,'Dumbbell Nebula, the first planetary nebula ever discovered.'],M28:[17900,0,'Globular cluster where the first cluster millisecond pulsar was found.'],M29:[4000,0,'Small open cluster near Gamma Cygni.'],M30:[26100,0,'Core-collapsed globular cluster in Capricornus.'],
M31:[2500000,35,'Andromeda Galaxy, the most distant thing easily seen with the naked eye.'],M32:[2490000,170,'Compact elliptical satellite of the Andromeda Galaxy.'],M33:[2730000,23,'Triangulum Galaxy, a face-on spiral at the edge of naked-eye visibility.'],M34:[1500,0,'Open cluster of about 100 stars, good in binoculars.'],M35:[2800,0,'Large open cluster at the feet of the Twins.'],M36:[4100,0,'Young open cluster in Auriga.'],M37:[4500,0,'Richest of Auriga’s three open clusters.'],M38:[4200,0,'Open cluster with a cross-shaped star pattern.'],M39:[1000,0,'Loose, bright open cluster in Cygnus.'],M40:[510,0,'Double star Winnecke 4, catalogued by mistake.'],
M41:[2300,0,'Open cluster 4° south of Sirius.'],M42:[1344,0,'Orion Nebula, the nearest large stellar nursery.'],M43:[1600,0,'De Mairan’s Nebula, a detached part of the Orion Nebula.'],M44:[577,0,'Beehive Cluster (Praesepe), visible to the naked eye.'],M45:[444,0,'Pleiades, the Seven Sisters: the best-known open cluster.'],M46:[5000,0,'Open cluster with a planetary nebula superimposed.'],M47:[1600,0,'Bright, coarse open cluster in Puppis.'],M48:[1500,0,'Large open cluster in Hydra.'],M49:[56000000,105,'Brightest galaxy of the Virgo Cluster.'],M50:[3200,0,'Heart-shaped open cluster in Monoceros.'],
M51:[23000000,163,'Whirlpool Galaxy, a face-on spiral tugged by NGC 5195.'],M52:[5000,0,'Rich open cluster in Cassiopeia.'],M53:[58000,0,'Globular cluster far out in the galactic halo.'],M54:[87400,0,'Globular cluster belonging to the Sagittarius Dwarf Galaxy.'],M55:[17600,0,'Large, loose globular cluster in Sagittarius.'],M56:[32900,0,'Small globular cluster between Albireo and Sulafat.'],M57:[2570,60,'Ring Nebula: a shell of gas thrown off by a dying star.'],M58:[62000000,95,'Barred spiral in the Virgo Cluster.'],M59:[50000000,163,'Elliptical galaxy in the Virgo Cluster.'],M60:[57000000,105,'Giant elliptical paired with spiral NGC 4647.'],
M61:[52500000,0,'Face-on barred spiral with many recorded supernovae.'],M62:[22500,0,'Irregular globular cluster near the galactic centre.'],M63:[29000000,104,'Sunflower Galaxy, a flocculent spiral.'],M64:[17000000,115,'Black Eye Galaxy, with a dark dust band across its core.'],M65:[35000000,3,'Spiral in the Leo Triplet.'],M66:[31000000,173,'Spiral in the Leo Triplet, distorted by its neighbours.'],M67:[2700,0,'One of the oldest known open clusters, about 4 billion years.'],M68:[33600,0,'Globular cluster in Hydra.'],M69:[29700,0,'Metal-rich globular cluster near the galactic centre.'],M70:[29300,0,'Compact globular cluster where comet Hale–Bopp was discovered.'],
M71:[13000,0,'Loose globular cluster in Sagitta.'],M72:[54600,0,'Faint, distant globular cluster in Aquarius.'],M73:[2500,0,'Asterism of four unrelated stars.'],M74:[32000000,0,'Phantom Galaxy, a classic face-on grand-design spiral.'],M75:[67500,0,'Highly concentrated globular cluster in Sagittarius.'],M76:[2500,40,'Little Dumbbell Nebula, a faint planetary nebula.'],M77:[47000000,70,'Active Seyfert galaxy, also called Cetus A.'],M78:[1350,0,'Brightest reflection nebula in the sky.'],M79:[41000,0,'Globular cluster in Lepus, possibly captured from a dwarf galaxy.'],M80:[32600,0,'One of the densest globular clusters in the Milky Way.'],
M81:[11800000,157,'Bode’s Galaxy, a bright grand-design spiral.'],M82:[11500000,65,'Cigar Galaxy, a starburst stirred up by M81.'],M83:[15000000,45,'Southern Pinwheel, a barred spiral rich in supernovae.'],M84:[60000000,135,'Lenticular galaxy at the head of Markarian’s Chain.'],M85:[60000000,10,'Lenticular galaxy at the north edge of the Virgo Cluster.'],M86:[52000000,128,'Elliptical galaxy falling through the Virgo Cluster toward us.'],M87:[53500000,160,'Giant elliptical whose black hole was the first ever imaged.'],M88:[47000000,142,'Multi-armed spiral in the Virgo Cluster.'],M89:[50000000,0,'Nearly round elliptical in Virgo.'],M90:[58700000,23,'Spiral galaxy in Virgo moving toward us.'],
M91:[63000000,110,'Barred spiral, the faintest Messier galaxy.'],M92:[26700,0,'Bright globular cluster in Hercules, often overlooked beside M13.'],M93:[3600,0,'Open cluster in Puppis.'],M94:[16000000,105,'Cat’s Eye Galaxy, with a bright starburst ring.'],M95:[33000000,0,'Barred spiral in the Leo I group.'],M96:[31000000,15,'Brightest galaxy of the Leo I group.'],M97:[2030,0,'Owl Nebula, a planetary nebula with two dark “eyes”.'],M98:[44000000,153,'Nearly edge-on spiral in Coma Berenices.'],M99:[50000000,0,'Lopsided face-on spiral in Coma Berenices.'],M100:[55000000,0,'Grand-design spiral in the Virgo Cluster.'],
M101:[21000000,0,'Pinwheel Galaxy, a large face-on spiral.'],M102:[50000000,128,'Spindle Galaxy (NGC 5866), edge-on with a dust lane.'],M103:[10000,0,'Arrowhead-shaped open cluster in Cassiopeia.'],M104:[31000000,90,'Sombrero Galaxy: bright bulge cut by a dust lane.'],M105:[32000000,0,'Elliptical galaxy in the Leo I group.'],M106:[23700000,150,'Spiral with an active nucleus and anomalous arms.'],M107:[20900,0,'Loose globular cluster in Ophiuchus.'],M108:[46000000,79,'Edge-on barred spiral near the Owl Nebula.'],M109:[83500000,23,'Barred spiral just below Phecda in the Big Dipper.'],M110:[2690000,170,'Elliptical satellite of the Andromeda Galaxy.'],
};
const TYPE_NAME = {gc: 'Globular cluster', oc: 'Open cluster', s: 'Spiral galaxy', e: 'Elliptical galaxy', i: 'Irregular galaxy', sfr: 'Star-forming nebula', en: 'Emission nebula', rn: 'Reflection nebula', snr: 'Supernova remnant', pn: 'Planetary nebula', pos: 'Star cloud or asterism', dn: 'Dark nebula', ds: 'Double star', as: 'Asterism', gg: 'Galaxy group'};
// [name, ZHR, radiant RA°, Dec°, active from [m,d], peak [m,d], active until [m,d], parent body]
const SHOWERS = [
  ['Quadrantids', 110, 230.1, 48.5, [12, 28], [1, 3], [1, 12], 'asteroid 2003 EH1'],
  ['Lyrids', 18, 271.4, 33.6, [4, 14], [4, 22], [4, 30], 'comet Thatcher'],
  ['Eta Aquariids', 50, 338.0, -1.0, [4, 19], [5, 6], [5, 28], 'comet Halley'],
  ['Southern Delta Aquariids', 25, 340.0, -16.0, [7, 12], [7, 30], [8, 23], 'comet 96P/Machholz'],
  ['Perseids', 100, 48.0, 58.0, [7, 17], [8, 12], [8, 24], 'comet Swift–Tuttle'],
  ['Draconids', 10, 262.0, 54.0, [10, 6], [10, 8], [10, 10], 'comet Giacobini–Zinner'],
  ['Orionids', 20, 95.0, 16.0, [10, 2], [10, 21], [11, 7], 'comet Halley'],
  ['Southern Taurids', 5, 52.0, 15.0, [9, 10], [11, 5], [11, 20], 'comet Encke'],
  ['Northern Taurids', 5, 58.0, 22.0, [10, 20], [11, 12], [12, 10], 'comet Encke'],
  ['Leonids', 15, 152.0, 22.0, [11, 6], [11, 17], [11, 30], 'comet Tempel–Tuttle'],
  ['Geminids', 150, 112.0, 33.0, [12, 4], [12, 14], [12, 20], 'asteroid 3200 Phaethon'],
  ['Ursids', 10, 217.0, 76.0, [12, 17], [12, 22], [12, 26], 'comet Tuttle'],
];
const SITES = [
  {name: 'Cherry Springs, Pennsylvania', lat: 41.663, lon: -77.823, h: 700, tz: 'America/New_York'},
  {name: 'Big Bend, Texas', lat: 29.25, lon: -103.25, h: 1100, tz: 'America/Chicago'},
  {name: 'Death Valley, California', lat: 36.46, lon: -116.87, h: 0, tz: 'America/Los_Angeles'},
  {name: 'Mauna Kea, Hawaiʻi', lat: 19.82, lon: -155.47, h: 4200, tz: 'Pacific/Honolulu'},
  {name: 'Jasper, Alberta', lat: 52.87, lon: -118.08, h: 1060, tz: 'America/Edmonton'},
  {name: 'Atacama, Chile', lat: -22.95, lon: -68.2, h: 2400, tz: 'America/Santiago'},
  {name: 'Galloway Forest, Scotland', lat: 55.1, lon: -4.4, h: 200, tz: 'Europe/London'},
  {name: 'Alqueva, Portugal', lat: 38.2, lon: -7.5, h: 150, tz: 'Europe/Lisbon'},
  {name: 'Westhavelland, Germany', lat: 52.7, lon: 12.3, h: 30, tz: 'Europe/Berlin'},
  {name: 'NamibRand, Namibia', lat: -25.0, lon: 16.0, h: 1000, tz: 'Africa/Windhoek'},
  {name: 'Wadi Rum, Jordan', lat: 29.58, lon: 35.42, h: 950, tz: 'Asia/Amman'},
  {name: 'Hanle, Ladakh', lat: 32.78, lon: 78.96, h: 4500, tz: 'Asia/Kolkata'},
  {name: 'Ishigaki, Japan', lat: 24.4, lon: 124.2, h: 30, tz: 'Asia/Tokyo'},
  {name: 'Warrumbungle, Australia', lat: -31.27, lon: 149.0, h: 600, tz: 'Australia/Sydney'},
  {name: 'Aoraki Mackenzie, New Zealand', lat: -43.99, lon: 170.46, h: 1030, tz: 'Pacific/Auckland'},
];
// colour, equatorial radius (km), north pole RA/Dec (J2000, IAU)
const PLANETS = [
  {n: 'Mercury', c: [205, 190, 170], R: 2440, pole: [281.01, 61.42]},
  {n: 'Venus', c: [255, 246, 222], R: 6052, pole: [272.76, 67.16]},
  {n: 'Mars', c: [255, 140, 92], R: 3396, pole: [317.68, 52.89]},
  {n: 'Jupiter', c: [242, 222, 190], R: 71492, pole: [268.06, 64.50]},
  {n: 'Saturn', c: [234, 212, 152], R: 60268, pole: [40.59, 83.54]},
  {n: 'Uranus', c: [170, 220, 226], R: 25559, pole: [257.31, -15.18]},
  {n: 'Neptune', c: [130, 160, 240], R: 24764, pole: [299.36, 43.46]},
];
const BORTLE = [null, ['Excellent dark site', 7.6], ['Truly dark site', 7.1], ['Rural sky', 6.6], ['Rural/suburban transition', 6.1], ['Suburban sky', 5.6], ['Bright suburban sky', 5.1], ['Suburban/urban transition', 4.6], ['City sky', 4.1], ['Inner-city sky', 3.6]];

// ================================================================== math
const v3 = (ra, dec) => { const r = ra * DEG, d = dec * DEG, c = Math.cos(d); return [c * Math.cos(r), c * Math.sin(r), Math.sin(d)]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mulM = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
const enuDir = (az, alt) => { const a = az * DEG, h = alt * DEG; return [Math.sin(a) * Math.cos(h), Math.cos(a) * Math.cos(h), Math.sin(h)]; };
const sepDeg = (a, b) => Math.acos(clamp(dot(a, b), -1, 1)) * RAD;
const vecRaDec = (v) => { let ra = Math.atan2(v[1], v[0]) * RAD; if (ra < 0) ra += 360; return [ra, Math.asin(clamp(v[2], -1, 1)) * RAD]; };
const towards = (v, t, k) => norm(v.map((x, i) => x + k * (t[i] - dot(v, t) * v[i]))); // nudge v toward t along the great circle
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const NCP = [0, 0, 1];
const EPS = 23.4393 * DEG;
const ECL_N = [0, -Math.sin(EPS), Math.cos(EPS)]; // ecliptic north pole, J2000
const altOf = (e) => Math.asin(clamp(e[2], -1, 1)) * RAD;
const azOf = (e) => { const a = Math.atan2(e[0], e[1]) * RAD; return a < 0 ? a + 360 : a; };
const airmass = (sinAlt) => 1 / (Math.max(sinAlt, 0) + 0.025 * Math.exp(-11 * Math.max(sinAlt, 0)));

// treeline / hill silhouette in degrees of altitude; the shader uses the same formula
function horizonProfile(az) {
  let h = 0.9 + 0.9 * Math.sin(az * 2 + 0.6) + 0.5 * Math.sin(az * 5 + 2.3) + 0.25 * Math.sin(az * 11 + 1.1);
  h = Math.max(h, 0.15);
  let t = Math.sin(az * 170) * 0.5 + 0.5; t = t * t * t * t;
  const trees = (0.45 + 0.35 * Math.sin(az * 23 + 0.4)) * t + 0.25 * Math.pow(0.5 + 0.5 * Math.sin(az * 61 + 1.7), 6);
  return h + trees * 1.6 * smooth(-0.2, 0.4, Math.sin(az + 2.0));
}
// B−V → RGB: Ballesteros temperature, then a blackbody fit, lifted toward white so stars read as tinted points
function bvToRgb(bv) {
  bv = clamp(bv, -0.4, 2.0);
  const t = 46 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  const m = 0.72, f = (x) => clamp(x, 0, 255) * m + 255 * (1 - m);
  return [f(r), f(g), f(b)];
}

// ================================================================== time zones
const fmtCache = {};
function fmt(tz, opts) { const k = tz + JSON.stringify(opts); return fmtCache[k] || (fmtCache[k] = new Intl.DateTimeFormat('en-GB', Object.assign({timeZone: tz}, opts))); }
function validTz(tz) { try { new Intl.DateTimeFormat('en-GB', {timeZone: tz}); return true; } catch (e) { return false; } }
function tzParts(tz, d) {
  const p = {}; for (const x of fmt(tz, {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'}).formatToParts(d)) p[x.type] = x.value;
  return {y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second};
}
function tzOffset(tz, d) { const p = tzParts(tz, d); return (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000) / 60000; }
function siteDate(tz, y, mo, d, h, mi) {
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) guess = Date.UTC(y, mo - 1, d, h, mi) - tzOffset(tz, new Date(guess)) * 60000;
  return new Date(guess);
}
const hm = (d) => fmt(S.site.tz, {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(d);
const dayLabel = (d) => fmt(S.site.tz, {weekday: 'short'}).format(d);
const dateLabel = (d) => fmt(S.site.tz, {day: 'numeric', month: 'short'}).format(d);
const sameLocalDay = (a, b) => { const p = tzParts(S.site.tz, a), q = tzParts(S.site.tz, b); return p.y === q.y && p.mo === q.mo && p.d === q.d; };
const relTime = (d) => (sameLocalDay(d, S.t) ? '' : dayLabel(d) + ' ') + hm(d);

// ================================================================== catalogue preparation
// Stars: bright rows (JSON, with names) followed by faint rows (packed binary), both sorted by magnitude.
const NB = SD.stars.length;
const FA = SD.faint, NF = FA.n, NS = NB + NF;
const SX = new Float32Array(NS), SY = new Float32Array(NS), SZ = new Float32Array(NS), SMAG = new Float32Array(NS);
const SR = new Uint8Array(NS), SG = new Uint8Array(NS), SBl = new Uint8Array(NS);
const FHIP = new Int32Array(NF), FLY = new Uint16Array(NF), FSC = new Uint8Array(NF), FLC = new Uint8Array(NF), FCON = new Uint8Array(NF), FCI = new Float32Array(NF);
(function prepStars() {
  const put = (i, ra, dec, mag, ci) => { const v = v3(ra, dec); SX[i] = v[0]; SY[i] = v[1]; SZ[i] = v[2]; SMAG[i] = mag; const c = bvToRgb(ci); SR[i] = c[0]; SG[i] = c[1]; SBl[i] = c[2]; };
  SD.stars.forEach((s, i) => put(i, s[0], s[1], s[2], s[3]));
  const bin = atob(FA.b64), buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const dv = new DataView(buf.buffer);
  for (let k = 0, o = 0; k < NF; k++, o += 21) {
    const ra = dv.getFloat32(o, true), dec = dv.getFloat32(o + 4, true), mag = dv.getInt16(o + 8, true) / 100, ci = dv.getInt16(o + 10, true) / 1000;
    FHIP[k] = dv.getInt32(o + 12, true); FLY[k] = dv.getUint16(o + 16, true); FSC[k] = dv.getUint8(o + 18); FLC[k] = dv.getUint8(o + 19); FCON[k] = dv.getUint8(o + 20); FCI[k] = ci;
    put(NB + k, ra, dec, mag, ci);
  }
})();
const starVec = (i) => [SX[i], SY[i], SZ[i]];
const GEN = {}, CONNAME = {};
SD.cons.forEach((c) => {
  if (c.id === 'Ser') c.la = c.pos[0] < 255 ? 'Serpens Caput' : 'Serpens Cauda';
  GEN[c.id] = c.gen; CONNAME[c.id] = c.id === 'Ser' ? 'Serpens' : c.la;
  c.v = v3(c.pos[0], c.pos[1]); c.lineV = c.lines.map((seg) => seg.map((p) => v3(p[0], p[1])));
});
const SPEC_LETTERS = ' OBAFGKMCSWDN', LUM_NAMES = ['', 'Ia', 'Ib', 'I', 'II', 'III', 'IV', 'V'];
function starInfo(i) {
  if (i < NB) {
    const s = SD.stars[i];
    return {mag: s[2], ci: s[3], hip: s[4], proper: s[5], desig: s[6], con: s[7], spect: s[8], ly: s[9], vari: s[10] || null};
  }
  const k = i - NB;
  return {mag: SMAG[i], ci: FCI[k], hip: FHIP[k], proper: '', desig: '', con: FA.cons[FCON[k]] || '', spect: FSC[k] ? SPEC_LETTERS[FSC[k]] + (FLC[k] ? ' ' + LUM_NAMES[FLC[k]] : '') : '', ly: FLY[k], vari: null};
}
const starTitle = (s) => s.proper || (s.desig ? `${s.desig} ${GEN[s.con] || s.con}` : s.hip ? `HIP ${s.hip}` : 'Star');
const namedBright = []; for (let i = 0; i < NB; i++) if (SD.stars[i][5] && SD.stars[i][2] <= 3.5) namedBright.push(i);

// Deep-sky objects: Messier first, then NGC/IC/Caldwell and named dark nebulae
const DSOS = [];
function seeded(str) { let s = 0; for (const ch of str) s = (s * 31 + ch.charCodeAt(0)) & 0x7fffffff; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
function clusterPoints(id, type) {
  const rnd = seeded(id), n = type === 'gc' ? 52 : type === 'oc' ? 18 : 0, pts = [];
  for (let k = 0; k < n; k++) {
    const r = type === 'gc' ? Math.min(Math.sqrt(-2 * Math.log(rnd() + 1e-6)) * 0.42, 1.2) : Math.sqrt(rnd()) * 0.95;
    const a = rnd() * 6.283; pts.push([Math.cos(a) * r, Math.sin(a) * r, 0.35 + rnd() * 0.65]);
  }
  return pts;
}
SD.messier.forEach((m) => {
  const n = MNOTES[m[0]] || [0, 0, ''];
  if (m[0] === 'M57') { m[5] = 1.4; m[6] = 1.0; }
  if (m[0] === 'M40') { m[5] = 0.8; m[6] = 0.8; }
  DSOS.push({id: m[0], name: m[2], desig: m[1], type: m[3], mag: m[4], a: m[5], b: m[6], v: v3(m[7], m[8]), pa: n[1], dist: n[0], note: n[2], messier: true, pts: clusterPoints(m[0], m[3])});
});
SD.dsos.forEach((d) => {
  DSOS.push({id: d[0], name: d[1], desig: '', type: d[2], mag: d[3], a: d[4], b: d[5], v: v3(d[6], d[7]), pa: 0, dist: 0, note: '', messier: false, pts: clusterPoints(d[0], d[2])});
});
const BORDERS = SD.borders.map((seg) => seg.map((p) => v3(p[0], p[1])));
SD.asterisms.forEach((a) => { a.v = v3(a.loc[0], a.loc[1]); a.lineV = a.lines.map((seg) => seg.map((p) => v3(p[0], p[1]))); });
SHOWERS.forEach((s) => (s.v = v3(s[2], s[3])));
PLANETS.forEach((p) => (p.poleV = v3(p.pole[0], p.pole[1])));

// Constellation art meshes: three anchor stars fix an affine map from image pixels to the tangent plane at their centroid
const ART = [], GRID = 6;
SD.art.forEach((a) => {
  if (a.a.length < 3) return;
  const av = a.a.map((x) => v3(x[2], x[3]));
  const c = norm([0, 1, 2].map((k) => av[0][k] + av[1][k] + av[2][k]));
  let e1 = cross(NCP, c); if (Math.hypot(...e1) < 1e-6) e1 = [1, 0, 0]; e1 = norm(e1);
  const e2 = cross(c, e1);
  const T = av.map((v) => { const d = dot(v, c); return [dot(v, e1) / d, dot(v, e2) / d]; });
  const P = a.a.map((x) => [x[0], x[1], 1]);
  const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(P); if (Math.abs(D) < 1e-9) return;
  const solve = (rhs) => [0, 1, 2].map((k) => det3(P.map((row, i) => row.map((v, j) => (j === k ? rhs[i] : v)))) / D);
  const cx = solve(T.map((t) => t[0])), cy = solve(T.map((t) => t[1]));
  const verts = [];
  for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) {
    const px = i / GRID * a.w, py = j / GRID * a.h;
    const X = cx[0] * px + cx[1] * py + cx[2], Y = cy[0] * px + cy[1] * py + cy[2];
    verts.push({v: norm([0, 1, 2].map((k) => c[k] + X * e1[k] + Y * e2[k])), px, py});
  }
  const item = {id: a.id, w: a.w, h: a.h, verts, center: c, img: null};
  const im = new Image();
  im.onload = () => {
    try {
      const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
      const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height), p = d.data;
      for (let k = 0; k < p.length; k += 4) { const l = p[k]; p[k] = 222; p[k + 1] = 186; p[k + 2] = 118; p[k + 3] = l; }
      g.putImageData(d, 0, 0); item.img = cv; item.sx = cv.width / a.w; item.sy = cv.height / a.h; requestRender();
    } catch (e) { warnOnce('art', e); }
  };
  im.src = a.img;
  ART.push(item);
});

// ================================================================== state
const VIEWS = {
  zenith: {az: 180, alt: 90, fov: 184, proj: 0, min: 30, max: 230},
  horizon: {az: 180, alt: 24, fov: 120, proj: 1, min: 12, max: 210},
  optic: {az: 180, alt: 35, fov: 50, proj: 2, min: 0.08, max: 110},
};
const S = {
  mode: 'zenith', site: null, t: new Date(), speed: 1, playing: true, bortle: 3, offX: 0,
  L: {art: 1, lines: 1, cnames: 1, borders: 0, asterisms: 0, snames: 1, dso: 1, ngc: 1, planets: 1, orbits: 1, meteors: 1, mw: 1, grid: 1, refs: 1, atm: 1, zodi: 1, tw: 1, ground: 1},
  sel: null, fly: null, interacting: 0,
};
let dirty = true;
const requestRender = () => { dirty = true; };
const warned = new Set();
function warnOnce(key, e) { if (warned.has(key)) return; warned.add(key); console.warn('[darksite]', key, e); }
function pickDefaultSite() {
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  const exact = SITES.find((s) => s.tz === tz); if (exact) return exact;
  if (/^America\/(Santiago|Argentina|Sao_Paulo|Lima|Bogota|Montevideo|La_Paz|Caracas)/.test(tz)) return SITES[5];
  if (/^America\/(Los_Angeles|Vancouver|Tijuana|Phoenix|Denver|Boise)/.test(tz)) return SITES[2];
  if (/^(Asia\/(Tokyo|Seoul|Taipei|Shanghai|Hong_Kong|Manila))/.test(tz)) return SITES[12];
  if (/^(Asia\/(Dubai|Riyadh|Baghdad|Jerusalem|Beirut|Tehran))/.test(tz)) return SITES[10];
  const byRegion = {Europe: 8, Africa: 9, Asia: 11, Australia: 13, Pacific: 14, Antarctica: 14};
  return SITES[byRegion[tz.split('/')[0]] ?? 0];
}
function tonight22(site, ref) {
  const p = tzParts(site.tz, ref || new Date());
  let d = siteDate(site.tz, p.y, p.mo, p.d, 22, 0);
  if (p.h < 5) d = new Date(d.getTime() - DAY);
  return d;
}
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('darksite.' + k) || 'null'); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('darksite.' + k, JSON.stringify(v)); } catch (e) {} },
};
(function restore() {
  const m = store.get('mode'); if (m && VIEWS[m]) S.mode = m;
  const L = store.get('layers'); if (L && typeof L === 'object') for (const k in S.L) if (k in L) S.L[k] = L[k] ? 1 : 0;
  const b = store.get('bortle'); if (b >= 1 && b <= 9) S.bortle = b;
  const s = store.get('site'); S.site = (s && isFinite(s.lat) && isFinite(s.lon) && validTz(s.tz)) ? s : pickDefaultSite();
  const vw = store.get('views'); if (vw) for (const k in VIEWS) if (vw[k]) for (const f of ['az', 'alt', 'fov']) if (isFinite(vw[k][f])) VIEWS[k][f] = clamp(vw[k][f], f === 'fov' ? VIEWS[k].min : -360, f === 'fov' ? VIEWS[k].max : 360);
  VIEWS.zenith.alt = 90;
})();
S.t = tonight22(S.site);
function save() { store.set('mode', S.mode); store.set('layers', S.L); store.set('site', S.site); store.set('bortle', S.bortle); store.set('views', VIEWS); }
let saveT = 0; const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(save, 500); };

// ================================================================== ephemeris
let E = null;
const observer = () => new A.Observer(S.site.lat, S.site.lon, S.site.h || 0);
function rotMatrix(date, obs) { // J2000 equatorial → East/North/Up rows
  const R = A.Rotation_EQJ_HOR(A.MakeTime(date), obs).rot; // HOR: x=north, y=west, z=zenith
  return [-R[0][1], -R[1][1], -R[2][1], R[0][0], R[1][0], R[2][0], R[0][2], R[1][2], R[2][2]];
}
function bodyEq(body, date, obs) { const e = A.Equator(body, date, obs, false, true); return {v: norm([e.vec.x, e.vec.y, e.vec.z]), raw: e.vec, dist: e.dist}; }
function limitingMag(sunAlt, moonSky, fov) {
  let lim = BORTLE[S.bortle][1] - 1.6 * moonSky * (S.bortle <= 4 ? 1 : 0.6);
  if (sunAlt > -18) lim = Math.min(lim, sunAlt > -6 ? 2.0 - (sunAlt + 6) * 0.55 : sunAlt > -12 ? 4.6 - (sunAlt + 12) * 0.43 : lim - (sunAlt + 18) * 0.32);
  // magnification: a narrower field acts like binoculars or a small telescope
  if (fov < 70) lim += Math.min(2.4 * Math.log10(70 / fov), 7);
  return lim;
}
function computeEphem(date) {
  const obs = observer(), M = rotMatrix(date, obs);
  const sun = bodyEq('Sun', date, obs), moon = bodyEq('Moon', date, obs);
  const mi = A.Illumination('Moon', date);
  const planets = PLANETS.map((p) => {
    const b = bodyEq(p.n, date, obs), il = A.Illumination(p.n, date);
    return {p, n: p.n, c: p.c, v: b.v, raw: b.raw, dist: b.dist, mag: il.mag, phase: il.phase_fraction, phaseAngle: il.phase_angle, ring: il.ring_tilt};
  });
  const sunAlt = altOf(mulM(M, sun.v)), moonAlt = altOf(mulM(M, moon.v));
  const twi = smooth(-18, -4, sunAlt);
  const moonSky = smooth(-3, 8, moonAlt) * Math.pow(mi.phase_fraction, 1.4);
  const lp = (S.bortle - 1) / 8;
  const dark = (1 - twi) * (1 - 0.55 * moonSky) * Math.pow(1 - lp, 1.5);
  let jm = null;
  try { const J = A.JupiterMoons(date), jr = planets[3].raw; jm = ['io', 'europa', 'ganymede', 'callisto'].map((k, i) => ({n: ['Io', 'Europa', 'Ganymede', 'Callisto'][i], v: norm([jr.x + J[k].x, jr.y + J[k].y, jr.z + J[k].z]), far: J[k].x * jr.x + J[k].y * jr.y + J[k].z * jr.z > 0, mag: [5.0, 5.3, 4.6, 5.7][i]})); } catch (e) { warnOnce('jmoons', e); }
  return {date, obs, M, sun: sun.v, sunAlt, moon: moon.v, moonDist: moon.dist, moonAlt, moonIllum: mi.phase_fraction, moonPA: mi.phase_angle, moonPhaseAngle: A.MoonPhase(date), moonMag: mi.mag, planets, jmoons: jm, dark, moonSky, lp, lim0: limitingMag(sunAlt, moonSky, 999)};
}
let arcCache = {key: null, arcs: null};
function planetArcs() {
  const key = S.site.lat + ',' + S.site.lon + ',' + Math.floor(S.t.getTime() / DAY);
  if (arcCache.key === key) return arcCache.arcs;
  const obs = observer(), arcs = {};
  const spans = {Mercury: [40, 1], Venus: [60, 2], Mars: [90, 3], Jupiter: [120, 4], Saturn: [120, 4], Uranus: [120, 6], Neptune: [120, 6]};
  for (const p of PLANETS) {
    const [span, step] = spans[p.n], pts = [];
    for (let d = -span; d <= span; d += step) pts.push({d, v: bodyEq(p.n, new Date(S.t.getTime() + d * DAY), obs).v});
    arcs[p.n] = {pts, span};
  }
  return (arcCache = {key, arcs}).arcs;
}
function activeShowers(date) {
  const p = tzParts(S.site.tz, date), out = [];
  for (const s of SHOWERS) {
    const toDay = (md, y) => Date.UTC(y, md[0] - 1, md[1]);
    for (const y of [p.y - 1, p.y, p.y + 1]) {
      let a = toDay(s[4], y), pk = toDay(s[5], y), b = toDay(s[6], y);
      if (pk < a) pk = toDay(s[5], y + 1);
      if (b < a) b = toDay(s[6], y + 1);
      const t = Date.UTC(p.y, p.mo - 1, p.d);
      if (t >= a && t <= b) { out.push({s, days: Math.round((t - pk) / DAY)}); break; }
    }
  }
  return out;
}

// ================================================================== projection
function viewParams(W, H) {
  const V = VIEWS[S.mode], fov = V.fov * DEG;
  const fF = V.proj === 0 ? (t) => t : V.proj === 1 ? (t) => 2 * Math.tan(t / 2) : (t) => Math.tan(t);
  const offX = (S.offX || 0) * W / Math.max(cssW, 1), Wv = W - offX;
  const base = V.proj === 0 ? Math.min(Wv * 0.98, H) : Math.max(Wv, H * 0.9);
  const k = (base / 2) / fF(fov / 2);
  const F = enuDir(V.az, V.alt), R = enuDir(V.az + 90, 0), U = cross(R, F);
  const maxT = V.proj === 0 ? Math.PI * 0.999 : V.proj === 1 ? Math.PI * 0.94 : Math.PI * 0.47;
  return {W, H, cx: Wv / 2, cy: H / 2, k, proj: V.proj, fF, maxT, F, R, U, fov: V.fov};
}
function camProj(vp, e) { return camProjXYZ(vp, dot(e, vp.R), dot(e, vp.U), dot(e, vp.F)); }
function camProjXYZ(vp, x, y, z) {
  const th = Math.acos(clamp(z, -1, 1));
  if (th > vp.maxT) return null;
  const rho = vp.fF(th) * vp.k, s = Math.hypot(x, y) || 1e-9;
  const dr = vp.proj === 0 ? 1 : vp.proj === 1 ? 1 / Math.pow(Math.cos(th / 2), 2) : 1 / Math.pow(Math.cos(th), 2);
  return {x: vp.cx + rho * x / s, y: vp.cy - rho * y / s, sc: vp.k * dr};
}
function unproject(vp, sx, sy) {
  const px = (sx - vp.cx) / vp.k, py = (vp.cy - sy) / vp.k, rho = Math.hypot(px, py);
  if (rho < 1e-9) return vp.F.slice();
  const th = vp.proj === 0 ? rho : vp.proj === 1 ? 2 * Math.atan(rho / 2) : Math.atan(rho);
  const s = Math.sin(th), c = Math.cos(th);
  return norm([0, 1, 2].map((i) => s * (px / rho * vp.R[i] + py / rho * vp.U[i]) + c * vp.F[i]));
}
const onScreen = (p, vp, m) => p && p.x > -m && p.y > -m && p.x < vp.W + m && p.y < vp.H + m;

// ================================================================== WebGL: sky and ground
const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.0-1.0,0.0,1.0); }`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uC; uniform float uK; uniform int uProj; uniform float uMaxT;
uniform vec3 uR, uU, uF; uniform mat3 uMinv;
uniform vec3 uSun, uMoon, uEclN; uniform float uMoonIllum, uDark, uAtm, uMWOn, uMode, uPx, uLP, uZodi;
uniform sampler2D uMW;
out vec4 o;
float finv(float r){ if(uProj==0) return r; if(uProj==1) return 2.0*atan(r*0.5); return atan(r); }
float prof(float az){
  float h = 0.9 + 0.9*sin(az*2.0+0.6) + 0.5*sin(az*5.0+2.3) + 0.25*sin(az*11.0+1.1);
  h = max(h, 0.15);
  float t = sin(az*170.0)*0.5+0.5; t = t*t*t*t;
  float trees = (0.45 + 0.35*sin(az*23.0+0.4))*t + 0.25*pow(0.5+0.5*sin(az*61.0+1.7), 6.0);
  return radians(h + trees*1.6*smoothstep(-0.2, 0.4, sin(az+2.0)));
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 p = (gl_FragCoord.xy - uC)/uK; float rho = length(p);
  float th = finv(rho);
  vec3 d = rho < 1e-6 ? uF : sin(th)*(p.x/rho*uR + p.y/rho*uU) + cos(th)*uF;
  bool outside = th > uMaxT;
  float alt = asin(clamp(d.z,-1.0,1.0));
  float az = atan(d.x, d.y);
  float sunAlt = asin(clamp(uSun.z,-1.0,1.0));
  float twi = smoothstep(radians(-18.0), radians(-4.0), sunAlt);
  float day = smoothstep(radians(-4.0), radians(8.0), sunAlt);
  float cosS = dot(d, uSun);
  float hz = pow(1.0 - max(alt, 0.0)/1.5708, 4.0);
  float low = exp(-max(alt,0.0)/0.06);
  vec3 night = mix(vec3(0.006,0.009,0.020), vec3(0.030,0.036,0.058), hz) + vec3(0.020,0.024,0.034)*low;
  night += vec3(0.010,0.016,0.008) * exp(-pow((alt-0.25)/0.15,2.0)) * 0.6;                  // green airglow band
  float town = exp(-max(alt,0.0)/0.07) * exp(-pow(mod(az - radians(248.0) + 3.14159, 6.28318) - 3.14159, 2.0)/0.18);
  night += vec3(0.040,0.026,0.012) * town * (0.6 + 2.0*uLP);                                // distant town dome
  night += vec3(0.16,0.12,0.08) * uLP * uLP * (0.35 + 0.65*hz) + vec3(0.05,0.04,0.035)*uLP; // light pollution
  vec3 tw = mix(vec3(0.02,0.05,0.14), vec3(0.95,0.48,0.20), hz * pow(0.5+0.5*cosS, 2.0)) + vec3(0.25,0.18,0.30)*hz*0.25;
  vec3 dayc = mix(vec3(0.16,0.36,0.74), vec3(0.62,0.76,0.92), hz) + vec3(1.0,0.95,0.85)*pow(max(cosS,0.0), 400.0)*2.0 + vec3(0.4,0.35,0.25)*pow(max(cosS,0.0),8.0)*0.4;
  vec3 col = night*(1.0 - twi) + tw*twi*(1.0 - day)*0.9 + dayc*day;
  float moonAlt = asin(clamp(uMoon.z,-1.0,1.0));
  float mUp = smoothstep(radians(-3.0), radians(4.0), moonAlt) * uMoonIllum;
  float cm = max(dot(d, uMoon), 0.0);
  col += mUp * (vec3(0.020,0.032,0.060)*(0.4+0.6*(1.0-hz*0.3)) + vec3(0.18,0.20,0.24)*pow(cm, 900.0) + vec3(0.06,0.07,0.09)*pow(cm, 60.0) + vec3(0.02,0.025,0.035)*pow(cm,6.0)) * (1.0 - day);
  float sa = max(sin(alt), 0.0);
  float X = 1.0 / (sa + 0.025*exp(-11.0*sa));
  float ext = mix(1.0, exp(-0.28*(X-1.0)), uAtm);
  float above = smoothstep(-0.02, 0.06, alt);
  // zodiacal light and gegenschein: dust in the plane of the solar system
  if (uZodi > 0.5) {
    float beta = asin(clamp(dot(d, uEclN), -1.0, 1.0));
    float elon = acos(clamp(cosS, -1.0, 1.0));
    float zl = exp(-abs(beta)/(0.07 + 0.22*elon/3.14159)) * exp(-(elon - 0.3)/0.55) * step(0.35, elon);
    zl += 0.10 * exp(-pow(3.14159 - elon, 2.0)/0.03) * exp(-beta*beta/0.02);
    col += vec3(0.95,0.88,0.72) * zl * 0.055 * uDark * ext * above;
  }
  if (uMWOn > 0.5) {
    vec3 q = uMinv * d;
    float u = fract(atan(q.y, q.x) / 6.28318 + 1.0);
    float v = acos(clamp(q.z,-1.0,1.0)) / 3.14159;
    float m = textureLod(uMW, vec2(u, v), 0.0).r;
    float mw = (m*0.36 + pow(m, 3.0)*0.26) * uDark * ext * above;
    col += mix(vec3(0.70,0.74,0.86), vec3(1.0,0.90,0.74), smoothstep(0.35, 0.9, m)) * mw;
  }
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  if (uMode < 0.5) { o = vec4(col, 1.0); return; }
  float edge = alt - prof(az);
  float aa = uPx / uK * 1.2;
  float ground = outside ? 1.0 : 1.0 - smoothstep(-aa, aa, edge);
  if (ground <= 0.0) { o = vec4(0.0); return; }
  vec3 gc = vec3(0.002,0.003,0.004) + vec3(0.008,0.010,0.008)*mUp + vec3(0.012,0.009,0.006)*uLP;
  gc = mix(gc, vec3(0.07,0.085,0.05), day);
  gc += col * 0.18 * exp(edge/0.012);
  o = vec4(gc * ground, ground);
}`;
function makeGL(canvas) {
  const gl = canvas.getContext('webgl2', {alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false});
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  const U = {};
  for (const n of ['uC', 'uK', 'uProj', 'uMaxT', 'uR', 'uU', 'uF', 'uMinv', 'uSun', 'uMoon', 'uEclN', 'uMoonIllum', 'uDark', 'uAtm', 'uMWOn', 'uMode', 'uPx', 'uLP', 'uZodi', 'uMW']) U[n] = gl.getUniformLocation(pr, n);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (mwImage) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mwImage); }
  return {gl, pr, U, tex, vao: gl.createVertexArray(), lost: false};
}
function glDraw(G, vp, mode, pxScale) {
  const gl = G.gl, U = G.U;
  if (G.lost || gl.isContextLost()) return;
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(G.pr); gl.bindVertexArray(G.vao);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex); gl.uniform1i(U.uMW, 0);
  gl.uniform2f(U.uC, vp.cx, vp.H - vp.cy); gl.uniform1f(U.uK, vp.k); gl.uniform1i(U.uProj, vp.proj); gl.uniform1f(U.uMaxT, vp.maxT);
  gl.uniform3fv(U.uR, vp.R); gl.uniform3fv(U.uU, vp.U); gl.uniform3fv(U.uF, vp.F);
  gl.uniformMatrix3fv(U.uMinv, false, E.M); // column-major upload of M's rows = Mᵀ = ENU → J2000
  gl.uniform3fv(U.uSun, mulM(E.M, E.sun)); gl.uniform3fv(U.uMoon, mulM(E.M, E.moon)); gl.uniform3fv(U.uEclN, mulM(E.M, ECL_N));
  gl.uniform1f(U.uMoonIllum, E.moonIllum); gl.uniform1f(U.uDark, E.dark); gl.uniform1f(U.uAtm, S.L.atm ? 1 : 0);
  gl.uniform1f(U.uMWOn, S.L.mw ? 1 : 0); gl.uniform1f(U.uMode, mode); gl.uniform1f(U.uPx, pxScale); gl.uniform1f(U.uLP, E.lp); gl.uniform1f(U.uZodi, S.L.zodi ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// ================================================================== canvases
const cSky = $('cSky'), cMain = $('cMain'), cTw = $('cTw'), cGround = $('cGround'), cHud = $('cHud');
let GS = null, GG = null, mwImage = null, fallback2D = null;
function initGL() {
  try { GS = makeGL(cSky); GG = makeGL(cGround); } catch (e) { warnOnce('webgl', e); GS = GG = null; }
  if (!GS || !GG) { GS = GG = null; fallback2D = {sky: cSky.getContext('2d'), ground: cGround.getContext('2d')}; toast('WebGL 2 is unavailable, so the Milky Way and sky glow are simplified.'); }
}
for (const c of [cSky, cGround]) {
  c.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); for (const G of [GS, GG]) if (G && G.gl.canvas === c) G.lost = true; });
  c.addEventListener('webglcontextrestored', () => { try { if (c === cSky) GS = makeGL(cSky); else GG = makeGL(cGround); } catch (e) { warnOnce('restore', e); } requestRender(); });
}
const xMain = cMain.getContext('2d'), xTw = cTw.getContext('2d'), xHud = cHud.getContext('2d');
let cssW = 1, cssH = 1, dpr = 1;
function resize() {
  const r = $('sky').getBoundingClientRect();
  cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const c of [cSky, cMain, cTw, cGround, cHud]) { c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr); }
  const P = $('panel').getBoundingClientRect();
  S.offX = matchMedia('(max-width:760px)').matches ? 0 : Math.max(0, r.right - P.left);
  requestRender(); tlDirty = true;
}
function loadMW() {
  const im = new Image();
  im.onload = () => { mwImage = im; for (const G of [GS, GG]) { if (!G) continue; const gl = G.gl; gl.bindTexture(gl.TEXTURE_2D, G.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); } requestRender(); };
  im.src = SD.mw;
}
// 2D fallback: gradient sky and a filled horizon
function fallbackSky(vp, ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, vp.H);
  const day = smooth(-6, 6, E.sunAlt);
  g.addColorStop(0, day > 0.5 ? '#2a5aa8' : '#05070f'); g.addColorStop(1, day > 0.5 ? '#9cbbe0' : '#0b0f1c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, vp.W, vp.H);
}
function fallbackGround(vp, ctx) {
  ctx.clearRect(0, 0, vp.W, vp.H);
  if (!S.L.ground) return;
  ctx.fillStyle = '#020305'; ctx.beginPath();
  if (vp.proj === 0) {
    const pts = []; for (let az = 0; az <= 360; az += 1) pts.push(camProj(vp, enuDir(az, horizonProfile(az * DEG)))); ctx.rect(0, 0, vp.W, vp.H); let first = true; for (const p of pts) if (p) { first ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); first = false; } ctx.closePath(); ctx.fill('evenodd'); return; }
  const az0 = VIEWS[S.mode].az, half = Math.min(100, vp.fov * 0.75), vis = [];
  for (let d = -half; d <= half; d += 0.5) { const az = az0 + d, p = camProj(vp, enuDir(az, horizonProfile(((az % 360) + 360) % 360 * DEG))); if (p) vis.push(p); }
  if (!vis.length) return;
  ctx.moveTo(vis[0].x, vp.H); for (const p of vis) ctx.lineTo(p.x, p.y); ctx.lineTo(vis[vis.length - 1].x, vp.H); ctx.closePath(); ctx.fill();
}

// star sprites, cached by quantised colour
const spriteCache = new Map();
function sprite(r, g, b) {
  const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  let s = spriteCache.get(key); if (s) return s;
  s = document.createElement('canvas'); s.width = s.height = 64;
  const x = s.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.12, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(0.3, `rgba(${r},${g},${b},.42)`);
  gr.addColorStop(0.6, `rgba(${r},${g},${b},.09)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  spriteCache.set(key, s); return s;
}

// ================================================================== labels with collision avoidance
let LABELS = [];
const queueLabel = (o) => LABELS.push(o); // {text, x, y, align, font, color, pri, sub?, subFont?, subColor?, force?}
function placeLabels(ctx) {
  LABELS.sort((a, b) => b.pri - a.pri);
  const boxes = [];
  const hits = (bx) => { for (const b of boxes) if (bx[0] < b[2] && bx[2] > b[0] && bx[1] < b[3] && bx[3] > b[1]) return true; return false; };
  ctx.textBaseline = 'middle';
  for (const L of LABELS) {
    ctx.font = L.font; const w = ctx.measureText(L.text).width; const h = L.size;
    let w2 = 0; if (L.sub) { ctx.font = L.subFont; w2 = ctx.measureText(L.sub).width; }
    const ww = Math.max(w, w2), hh = h + (L.sub ? L.subSize + 2 : 0);
    const x0 = L.align === 'center' ? L.x - ww / 2 : L.align === 'right' ? L.x - ww : L.x;
    const bx = [x0 - 2, L.y - h / 2 - 1, x0 + ww + 2, L.y - h / 2 + hh + 1];
    if (!L.force && hits(bx)) continue;
    boxes.push(bx);
    ctx.textAlign = L.align; ctx.font = L.font; ctx.fillStyle = L.color;
    if (L.halo) { ctx.lineWidth = L.halo; ctx.strokeStyle = 'rgba(3,5,10,.7)'; ctx.strokeText(L.text, L.x, L.y); }
    ctx.fillText(L.text, L.x, L.y);
    if (L.sub) { ctx.font = L.subFont; ctx.fillStyle = L.subColor; ctx.fillText(L.sub, L.x, L.y + h / 2 + L.subSize / 2 + 2); }
  }
  LABELS = [];
}

// ================================================================== main render
let HITS = [], LOWSTARS = [];
function polyline(ctx, vp, enuPts, maxJump) {
  let started = false, last = null;
  ctx.beginPath();
  for (const e of enuPts) {
    const p = camProj(vp, e);
    if (!p) { started = false; last = null; continue; }
    if (last && Math.hypot(p.x - last.x, p.y - last.y) > maxJump) started = false;
    if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    last = p;
  }
  ctx.stroke();
}
const greatCircle = (fn, n) => { const pts = []; for (let i = 0; i <= n; i++) pts.push(fn(i / n * 2 * Math.PI)); return pts; };
function layer(name, fn) { try { fn(); } catch (e) { warnOnce(name, e); } }

function renderMain(ctx, vp, Sx, opt) {
  const W = vp.W, H = vp.H, M = E.M;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  const hits = opt.hits ? [] : null, low = [];
  const dayFade = 1 - smooth(-10, 2, E.sunAlt);
  const maxJump = Math.max(W, H) * 0.35;
  const fovScale = clamp(Math.pow(120 / vp.fov, 0.3), 0.8, 2.1) * clamp(Math.min(cssW, cssH) / 820, 0.7, 1);
  const toENU = (v) => mulM(M, v);
  const lim = limitingMag(E.sunAlt, E.moonSky, vp.fov);
  const lowQ = opt.lowQ;
  const selCon = S.sel && S.sel.kind === 'con' ? S.sel.ref : null;
  const fs = (px) => px * Sx;
  LABELS = [];

  if (S.L.grid) layer('grid', () => {
    ctx.lineWidth = Sx; ctx.strokeStyle = `rgba(150,160,185,${0.09 + 0.07 * dayFade})`; ctx.setLineDash([]);
    for (const alt of [30, 60]) { const pts = []; for (let az = 0; az <= 360; az += 3) pts.push(enuDir(az, alt)); polyline(ctx, vp, pts, maxJump); }
    for (let az = 0; az < 360; az += 30) { const pts = []; for (let alt = 0; alt <= 88; alt += 2) pts.push(enuDir(az, alt)); polyline(ctx, vp, pts, maxJump); }
    for (const alt of [30, 60]) { const p = camProj(vp, enuDir(VIEWS[S.mode].az + 4, alt)); if (onScreen(p, vp, 0)) queueLabel({text: alt + '°', x: p.x + 3 * Sx, y: p.y - 6 * Sx, align: 'left', font: `${fs(10)}px "IBM Plex Mono", monospace`, size: fs(10), color: 'rgba(150,160,185,.4)', pri: 2}); }
  });
  if (S.L.refs) layer('refs', () => {
    ctx.lineWidth = Sx; ctx.setLineDash([5 * Sx, 6 * Sx]);
    const eq = greatCircle((a) => toENU([Math.cos(a), Math.sin(a), 0]), 240);
    const ec = greatCircle((l) => toENU([Math.cos(l), Math.sin(l) * Math.cos(EPS), Math.sin(l) * Math.sin(EPS)]), 240);
    ctx.strokeStyle = `rgba(110,160,220,${0.38 * dayFade + 0.1})`; polyline(ctx, vp, eq, maxJump);
    ctx.strokeStyle = `rgba(226,180,96,${0.45 * dayFade + 0.1})`; polyline(ctx, vp, ec, maxJump);
    ctx.setLineDash([]);
    const lab = (pts, txt, col) => { let best = null; for (const e of pts) { if (e[2] < 0.12) continue; const p = camProj(vp, e); if (p && p.x > 60 * Sx && p.x < W - 60 * Sx && p.y > 60 * Sx && p.y < H - 60 * Sx && (!best || e[2] < best.e[2])) best = {p, e}; } if (best) queueLabel({text: txt, x: best.p.x, y: best.p.y - 8 * Sx, align: 'center', font: `italic ${fs(11.5)}px "IM Fell English", Georgia, serif`, size: fs(11.5), color: col, pri: 6}); };
    lab(eq, 'celestial equator', `rgba(140,180,230,${0.55 * dayFade + 0.15})`);
    lab(ec, 'ecliptic', `rgba(230,190,110,${0.6 * dayFade + 0.15})`);
  });
  if (S.L.art) layer('art', () => {
    const base = 0.30 * (0.35 + 0.65 * dayFade);
    const step = lowQ ? 2 : 1, n = GRID + 1;
    for (const a of ART) {
      if (!a.img) continue;
      const ce = toENU(a.center); if (ce[2] < -0.45) continue;
      const P = a.verts.map((vx) => camProj(vp, toENU(vx.v)));
      ctx.globalAlpha = selCon && selCon.id === a.id ? Math.min(base * 2.2, 0.75) : base;
      for (let j = 0; j < GRID; j += step) for (let i = 0; i < GRID; i += step) {
        const i00 = j * n + i, i10 = i00 + step, i01 = i00 + n * step, i11 = i01 + step;
        drawTri(ctx, a, P, i00, i10, i11, maxJump * 0.5); drawTri(ctx, a, P, i00, i11, i01, maxJump * 0.5);
      }
    }
    ctx.globalAlpha = 1;
  });
  if (S.L.borders) layer('borders', () => {
    ctx.lineWidth = Sx; ctx.setLineDash([2 * Sx, 4 * Sx]); ctx.strokeStyle = `rgba(150,170,210,${0.22 * dayFade + 0.05})`;
    for (const seg of BORDERS) polyline(ctx, vp, seg.map(toENU), maxJump);
    ctx.setLineDash([]);
  });
  if (S.L.lines) layer('lines', () => {
    ctx.lineCap = 'round';
    for (const c of SD.cons) {
      const hi = selCon && selCon.id === c.id && selCon.la === c.la;
      ctx.lineWidth = (hi ? 2 : 1.1) * Sx; ctx.strokeStyle = hi ? 'rgba(240,210,140,.9)' : `rgba(201,166,94,${0.42 * dayFade + 0.08})`;
      for (const seg of c.lineV) polyline(ctx, vp, seg.map(toENU), maxJump);
    }
  });
  if (S.L.asterisms) layer('asterisms', () => {
    ctx.lineWidth = 1.2 * Sx; ctx.strokeStyle = `rgba(150,200,230,${0.45 * dayFade + 0.08})`; ctx.setLineDash([1 * Sx, 3 * Sx]); ctx.lineCap = 'round';
    for (const a of SD.asterisms) {
      if (a.p > (vp.fov > 150 ? 2 : vp.fov > 70 ? 3 : 4)) continue;
      for (const seg of a.lineV) polyline(ctx, vp, seg.map(toENU), maxJump);
      const e = toENU(a.v), p = e[2] > 0.03 && camProj(vp, e);
      if (onScreen(p, vp, 0)) queueLabel({text: a.n, x: p.x, y: p.y, align: 'center', font: `italic ${fs(11)}px "IM Fell English", Georgia, serif`, size: fs(11), color: `rgba(160,205,232,${0.7 * dayFade + 0.1})`, pri: 18});
    }
    ctx.setLineDash([]);
  });
  if (S.L.cnames) layer('cnames', () => {
    const rankMax = vp.fov > 150 ? 2 : 3;
    for (const c of SD.cons) {
      if (c.rank > rankMax && !(selCon && selCon === c)) continue;
      const e = toENU(c.v); if (e[2] < 0.02) continue;
      const p = camProj(vp, e); if (!onScreen(p, vp, 0)) continue;
      const size = fs((c.rank === 1 ? 14.5 : 13) * Math.min(fovScale, 1.35));
      queueLabel({text: c.la, x: p.x, y: p.y, align: 'center', font: `italic ${size}px "IM Fell English", Georgia, serif`, size, color: `rgba(222,196,140,${0.66 * dayFade + 0.12})`, pri: 40 - c.rank * 3,
        sub: c.id.toUpperCase(), subFont: `500 ${fs(8.5)}px "IBM Plex Mono", monospace`, subSize: fs(8.5), subColor: `rgba(201,166,94,${0.5 * dayFade + 0.08})`});
      if (hits) hits.push({x: p.x, y: p.y, r: size * 2.5, kind: 'con', ref: c, pri: -2});
    }
  });
  if (S.L.dso || S.L.ngc) layer('dso', () => drawDSOs(ctx, vp, Sx, hits, lim));
  if (S.L.planets && S.L.orbits) layer('orbits', () => {
    const arcs = planetArcs();
    for (const p of PLANETS) {
      if ((p.n === 'Uranus' || p.n === 'Neptune') && vp.fov > 60) continue;
      const arc = arcs[p.n]; let last = null;
      ctx.lineWidth = 1.2 * Sx;
      for (const pt of arc.pts) {
        const q = camProj(vp, toENU(pt.v));
        if (q && last && Math.hypot(q.x - last.x, q.y - last.y) < maxJump) {
          const a = 0.5 * (1 - Math.abs(pt.d) / arc.span) * (0.4 + 0.6 * dayFade);
          ctx.strokeStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${a})`;
          ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          if (pt.d % 30 === 0 && pt.d !== 0) { ctx.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${a + 0.15})`; ctx.beginPath(); ctx.arc(q.x, q.y, 1.6 * Sx, 0, 7); ctx.fill(); }
        }
        last = q;
      }
    }
  });
  layer('stars', () => {
    // fast path: camera matrix rows composed with the J2000→ENU rotation
    const R = vp.R, U = vp.U, F = vp.F;
    const row = (a) => [a[0] * M[0] + a[1] * M[3] + a[2] * M[6], a[0] * M[1] + a[1] * M[4] + a[2] * M[7], a[0] * M[2] + a[1] * M[5] + a[2] * M[8]];
    const PR = row(R), PU = row(U), PF = row(F), MU = [M[6], M[7], M[8]];
    const atm = S.L.atm, twOn = S.L.tw && !REDUCED && opt.collectLow;
    const magCut = lim + 0.3, nameMag = vp.fov > 150 ? 1.6 : vp.fov > 80 ? 2.4 : vp.fov > 30 ? 3.6 : 5;
    const cullDot = Math.cos(Math.min(vp.maxT, (vp.proj === 2 ? Math.atan(Math.hypot(W, H) / 2 / vp.k) : Math.PI)) + 0.02);
    for (let i = 0; i < NS; i++) {
      const mag = SMAG[i]; if (mag > magCut) break;
      const x = SX[i], y = SY[i], z = SZ[i];
      const cz = PF[0] * x + PF[1] * y + PF[2] * z; if (cz < cullDot) continue;
      const up = MU[0] * x + MU[1] * y + MU[2] * z; if (up < -0.01) continue;
      const p = camProjXYZ(vp, PR[0] * x + PR[1] * y + PR[2] * z, PU[0] * x + PU[1] * y + PU[2] * z, cz);
      if (!p || p.x < -10 || p.y < -10 || p.x > W + 10 || p.y > H + 10) continue;
      const X = atm ? airmass(up) : 1;
      const m = mag + (atm ? 0.28 * (X - 1) : 0);
      const dm = lim - m; if (dm < -0.2) continue;
      const r = Math.max(0.55, 0.9 + Math.min(dm, 8) * 0.6) * Sx * fovScale * (mag < 0.5 ? 1.15 : 1);
      const al = clamp((dm + 0.2) / 1.4, 0, 1);
      let cr = SR[i], cg = SG[i], cb = SBl[i];
      if (atm && X > 1.5) { const red = clamp((X - 1) / 14, 0, 1) * 0.85; cr = cr + (255 - cr) * red * 0.2; cg *= 1 - red * 0.38; cb *= 1 - red * 0.68; }
      const altDeg = Math.asin(clamp(up, -1, 1)) * RAD;
      const sp = sprite(cr | 0, cg | 0, cb | 0), size = r * 6.2;
      if (twOn && altDeg < 30) low.push({x: p.x, y: p.y, size, al, sp, amp: 0.42 * Math.pow(1 - altDeg / 30, 1.3), i});
      else { ctx.globalAlpha = al; ctx.drawImage(sp, p.x - size / 2, p.y - size / 2, size, size); }
      if (hits) hits.push({x: p.x, y: p.y, r: Math.max(r * 2, 3 * Sx), kind: 'star', ref: i, pri: 6 - mag});
      if (S.L.snames && i < NB && mag < nameMag && altDeg > 1.5) {
        const s = SD.stars[i]; const nm = s[5] || (vp.fov < 30 && s[6] ? s[6] : '');
        if (nm) queueLabel({text: nm, x: p.x + 6 * Sx + r, y: p.y, align: 'left', font: `${fs(s[5] ? 10.5 : 10)}px "IBM Plex Sans Condensed", sans-serif`, size: fs(10.5), color: `rgba(200,210,232,${(s[5] ? 0.6 : 0.42) * al})`, pri: 30 - mag * 3});
      }
    }
    ctx.globalAlpha = 1;
  });
  if (S.L.meteors) layer('meteors', () => {
    for (const {s, days} of activeShowers(S.t)) {
      const e = toENU(s.v); if (e[2] < -0.05) continue;
      const p = camProj(vp, e); if (!onScreen(p, vp, 20)) continue;
      const near = Math.exp(-Math.abs(days) / 3), a = (0.35 + 0.55 * near) * (0.3 + 0.7 * dayFade);
      ctx.strokeStyle = `rgba(150,220,235,${a})`; ctx.lineWidth = 1.1 * Sx;
      for (let k = 0; k < 10; k++) { const ang = k / 10 * Math.PI * 2 + 0.2, r0 = 5 * Sx, r1 = (12 + (k % 2) * 7 + near * 8) * Sx; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(ang) * r0, p.y + Math.sin(ang) * r0); ctx.lineTo(p.x + Math.cos(ang) * r1, p.y + Math.sin(ang) * r1); ctx.stroke(); }
      queueLabel({text: s[0], x: p.x, y: p.y + 30 * Sx, align: 'center', font: `600 ${fs(10.5)}px "IBM Plex Sans Condensed", sans-serif`, size: fs(10.5), color: `rgba(160,225,238,${a + 0.1})`, pri: 60,
        sub: days === 0 ? `peak tonight · ZHR ${s[1]}` : days < 0 ? `peak in ${-days} d · ZHR ${s[1]}` : `${days} d after peak`, subFont: `${fs(9.5)}px "IBM Plex Mono", monospace`, subSize: fs(9.5), subColor: `rgba(150,210,225,${a})`});
      if (hits) hits.push({x: p.x, y: p.y, r: 16 * Sx, kind: 'meteor', ref: {s, days}, pri: 5});
    }
  });
  if (S.L.planets) layer('bodies', () => drawBodies(ctx, vp, Sx, hits, lim, dayFade));
  if (S.sel) layer('reticle', () => drawReticle(ctx, vp, Sx));
  layer('labels', () => placeLabels(ctx));
  if (hits) HITS = hits;
  if (opt.collectLow) LOWSTARS = low;
}
function drawTri(ctx, a, P, i0, i1, i2, maxEdge) {
  const p0 = P[i0], p1 = P[i1], p2 = P[i2];
  if (!p0 || !p1 || !p2) return;
  if (Math.hypot(p0.x - p1.x, p0.y - p1.y) > maxEdge || Math.hypot(p1.x - p2.x, p1.y - p2.y) > maxEdge || Math.hypot(p2.x - p0.x, p2.y - p0.y) > maxEdge) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  if (Math.max(p0.x, p1.x, p2.x) < 0 || Math.min(p0.x, p1.x, p2.x) > W || Math.max(p0.y, p1.y, p2.y) < 0 || Math.min(p0.y, p1.y, p2.y) > H) return;
  const V = a.verts, sx = a.sx, sy = a.sy;
  const u0 = V[i0].px * sx, v0 = V[i0].py * sy, u1 = V[i1].px * sx, v1 = V[i1].py * sy, u2 = V[i2].px * sx, v2 = V[i2].py * sy;
  const x0 = p0.x, y0 = p0.y, x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const den = u0 * (v2 - v1) - u1 * v2 + u2 * v1 + (u1 - u2) * v0;
  if (Math.abs(den) < 1e-9) return;
  const m11 = -(v0 * (x2 - x1) - v1 * x2 + v2 * x1 + (v1 - v2) * x0) / den;
  const m12 = (v1 * y2 + v0 * (y1 - y2) - v2 * y1 + (v2 - v1) * y0) / den;
  const m21 = (u0 * (x2 - x1) - u1 * x2 + u2 * x1 + (u1 - u2) * x0) / den;
  const m22 = -(u1 * y2 + u0 * (y1 - y2) - u2 * y1 + (u2 - u1) * y0) / den;
  const dx = (u0 * (v2 * x1 - v1 * x2) + v0 * (u1 * x2 - u2 * x1) + (u2 * v1 - u1 * v2) * x0) / den;
  const dy = (u0 * (v2 * y1 - v1 * y2) + v0 * (u1 * y2 - u2 * y1) + (u2 * v1 - u1 * v2) * y0) / den;
  const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
  const ex = (x, y) => { const d = Math.hypot(x - cx, y - cy) || 1; return [x + (x - cx) / d * 0.7, y + (y - cy) / d * 0.7]; };
  const a0 = ex(x0, y0), a1 = ex(x1, y1), a2 = ex(x2, y2);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.closePath(); ctx.clip();
  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(a.img, 0, 0);
  ctx.restore();
}
function drawGlow(ctx, x, y, r, c, a) {
  if (r <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`); g.addColorStop(0.25, `rgba(${c[0]},${c[1]},${c[2]},${a * 0.35})`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
// lit portion of a sphere: bright limb toward screen angle `ang`, phase angle pa (0 = full, 180 = new)
function phasePath(ctx, r, pa) {
  const k = Math.cos(pa * DEG);
  ctx.beginPath(); ctx.moveTo(0, -r);
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, Math.abs(r * k), r, 0, Math.PI / 2, -Math.PI / 2, k < 0);
  ctx.closePath();
}
function drawMoonDisc(ctx, x, y, r, ang, pa) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(64,78,104,.42)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); // earthshine
  phasePath(ctx, r, pa);
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.1, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#f4f1e8'); g.addColorStop(1, '#cfcabd');
  ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(120,118,112,.28)';
  for (const [mx, my, mr] of [[-0.25, -0.35, 0.28], [0.2, -0.3, 0.22], [0.05, 0.1, 0.3], [-0.38, 0.25, 0.2], [0.3, 0.35, 0.14]]) { ctx.beginPath(); ctx.arc(mx * r, my * r, mr * r, 0, 7); ctx.fill(); }
  ctx.restore();
}
// screen angle of the direction from v toward t (on the sphere)
function screenAngle(vp, v, t, p) { const q = camProj(vp, mulM(E.M, towards(v, t, 0.01))); return q ? Math.atan2(q.y - p.y, q.x - p.x) : 0; }

function drawBodies(ctx, vp, Sx, hits, lim, dayFade) {
  const toENU = (v) => mulM(E.M, v), atm = S.L.atm;
  const labelFont = `600 ${11 * Sx}px "IBM Plex Sans Condensed", sans-serif`;
  const se = toENU(E.sun);
  if (se[2] > -0.02) { const p = camProj(vp, se); if (p) { drawGlow(ctx, p.x, p.y, 70 * Sx, [255, 236, 190], 0.6); ctx.fillStyle = '#fff8e6'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.267 * DEG * p.sc, 6 * Sx), 0, 7); ctx.fill(); if (hits) hits.push({x: p.x, y: p.y, r: 14 * Sx, kind: 'sun', pri: 30}); queueLabel({text: 'Sun', x: p.x + 12 * Sx, y: p.y - 12 * Sx, align: 'left', font: labelFont, size: 11 * Sx, color: 'rgba(255,240,200,.9)', pri: 100, force: true}); } }
  for (const pl of E.planets) {
    const e = toENU(pl.v); if (e[2] < -0.01) continue;
    const p = camProj(vp, e); if (!onScreen(p, vp, 40)) continue;
    const m = pl.mag + (atm ? 0.28 * (airmass(e[2]) - 1) : 0);
    const vis = clamp((lim + 1.5 - m) / 2, 0, 1); if (vis <= 0) continue;
    const rTrue = (pl.p.R / (pl.dist * AU_KM)) * p.sc; // radians × px/rad
    const rDot = clamp(2.1 + (2.2 - m) * 0.55, 1.4, 5.8) * Sx * Math.min(Math.pow(120 / vp.fov, 0.3), 1.4);
    const r = Math.max(rTrue, rDot);
    drawGlow(ctx, p.x, p.y, Math.max(r * 2.5, rDot * 5.5), pl.c, (rTrue > 6 ? 0.12 : 0.35) * vis);
    ctx.globalAlpha = vis;
    if (rTrue > 3 * Sx) drawPlanetDisc(ctx, vp, pl, p, rTrue, Sx);
    else {
      ctx.fillStyle = `rgb(${pl.c[0]},${pl.c[1]},${pl.c[2]})`; ctx.beginPath(); ctx.arc(p.x, p.y, rDot, 0, 7); ctx.fill();
      if (pl.n === 'Saturn') { ctx.strokeStyle = `rgba(${pl.c[0]},${pl.c[1]},${pl.c[2]},.7)`; ctx.lineWidth = 0.9 * Sx; const ang = screenAngle(vp, pl.v, pl.p.poleV, p) + Math.PI / 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, rDot * 2.1, rDot * 2.1 * Math.max(Math.abs(Math.sin((pl.ring || 10) * DEG)), 0.12), ang, 0, 7); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    queueLabel({text: pl.n, x: p.x + r + 6 * Sx, y: p.y - r - 4 * Sx, align: 'left', font: labelFont, size: 11 * Sx, color: `rgba(${pl.c[0]},${pl.c[1]},${pl.c[2]},${0.9 * vis})`, pri: 90, halo: 3 * Sx});
    if (hits) hits.push({x: p.x, y: p.y, r: Math.max(r * 1.3, 9 * Sx), kind: 'planet', ref: pl, pri: 20});
    if (pl.n === 'Jupiter' && E.jmoons && vp.fov < 12) for (const jm of E.jmoons) {
      const q = camProj(vp, toENU(jm.v)); if (!q) continue;
      // occulted: on the far side of Jupiter and inside its disc
      if (jm.far && Math.hypot(q.x - p.x, q.y - p.y) < rTrue) continue;
      ctx.fillStyle = 'rgba(240,236,226,.95)'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.2 * Sx, rTrue * 0.035), 0, 7); ctx.fill();
      queueLabel({text: jm.n, x: q.x, y: q.y + 9 * Sx, align: 'center', font: `${10 * Sx}px "IBM Plex Sans Condensed", sans-serif`, size: 10 * Sx, color: 'rgba(220,214,200,.75)', pri: 70});
      if (hits) hits.push({x: q.x, y: q.y, r: 6 * Sx, kind: 'jmoon', ref: jm, pri: 18});
    }
  }
  const me = toENU(E.moon);
  if (me[2] > -0.02) {
    const p = camProj(vp, me);
    if (onScreen(p, vp, 200)) {
      const rTrue = 1737.4 / (E.moonDist * AU_KM) * p.sc;
      const r = Math.max(rTrue, 7.5 * Sx);
      const ang = screenAngle(vp, E.moon, E.sun, p);
      drawGlow(ctx, p.x, p.y, Math.max(r * 7, 60 * Sx), [210, 220, 240], 0.25 * E.moonIllum + 0.05);
      drawMoonDisc(ctx, p.x, p.y, r, ang, E.moonPA);
      queueLabel({text: 'Moon', x: p.x + r * 0.75 + 6 * Sx, y: p.y - r * 0.75 - 4 * Sx, align: 'left', font: labelFont, size: 11 * Sx, color: 'rgba(220,226,240,.85)', pri: 95, halo: 3 * Sx});
      if (hits) hits.push({x: p.x, y: p.y, r: Math.max(r, 10 * Sx), kind: 'moon', pri: 25});
    }
  }
}
function drawPlanetDisc(ctx, vp, pl, p, r, Sx) {
  const c = pl.c, poleAng = screenAngle(vp, pl.v, pl.p.poleV, p);
  const sunAng = screenAngle(vp, pl.v, E.sun, p);
  ctx.save(); ctx.translate(p.x, p.y);
  if (pl.n === 'Saturn') { // rings: back half, globe, front half
    const tilt = pl.ring || 0, k = Math.max(Math.abs(Math.sin(tilt * DEG)), 0.02);
    ctx.rotate(poleAng + Math.PI / 2); // pole now points to −y
    const ring = (from, to) => {
      for (const [ro, ri, a] of [[2.27, 2.03, 0.75], [1.99, 1.53, 0.95], [1.52, 1.24, 0.25]]) {
        ctx.beginPath(); ctx.ellipse(0, 0, r * ro, r * ro * k, 0, from, to, false); ctx.ellipse(0, 0, r * ri, r * ri * k, 0, to, from, true); ctx.closePath();
        ctx.fillStyle = `rgba(${c[0]},${c[1] - 6},${c[2] - 20},${a})`; ctx.fill();
      }
    };
    const front = tilt >= 0 ? [0, Math.PI] : [Math.PI, 2 * Math.PI];
    ring(front[1], front[0] + 2 * Math.PI);
    globe(ctx, r * 0.9, c, true); // Saturn is visibly oblate
    ring(front[0], front[1]);
  } else if (pl.n === 'Jupiter') {
    ctx.rotate(poleAng + Math.PI / 2);
    globe(ctx, r, c, true);
  } else {
    ctx.rotate(sunAng);
    ctx.fillStyle = `rgba(${c[0] * 0.25},${c[1] * 0.25},${c[2] * 0.3},.55)`; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    phasePath(ctx, r, pl.phaseAngle);
    const g = ctx.createRadialGradient(r * 0.3, 0, r * 0.1, 0, 0, r);
    g.addColorStop(0, `rgb(${Math.min(255, c[0] + 20)},${Math.min(255, c[1] + 20)},${Math.min(255, c[2] + 20)})`); g.addColorStop(1, `rgb(${c[0] * 0.75 | 0},${c[1] * 0.75 | 0},${c[2] * 0.75 | 0})`);
    ctx.fillStyle = g; ctx.fill();
    if (pl.n === 'Mars') { ctx.rotate(poleAng - sunAng + Math.PI / 2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(0, -r * 0.82, r * 0.3, r * 0.13, 0, 0, 7); ctx.fill(); }
  }
  ctx.restore();
  function globe(ctx, rr, c, banded) {
    const flat = pl.n === 'Jupiter' ? 0.935 : pl.n === 'Saturn' ? 0.902 : 1;
    ctx.save(); ctx.scale(1, flat);
    const g = ctx.createRadialGradient(-rr * 0.25, -rr * 0.2, rr * 0.1, 0, 0, rr);
    g.addColorStop(0, `rgb(${Math.min(255, c[0] + 12)},${Math.min(255, c[1] + 10)},${c[2]})`); g.addColorStop(1, `rgb(${c[0] * 0.62 | 0},${c[1] * 0.58 | 0},${c[2] * 0.5 | 0})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.fill();
    if (banded) {
      ctx.clip();
      const bands = pl.n === 'Jupiter' ? [[-0.42, 0.1, 0.32], [-0.18, 0.12, 0.42], [0.16, 0.13, 0.42], [0.4, 0.08, 0.3], [0.62, 0.06, 0.2], [-0.62, 0.06, 0.2]] : [[-0.25, 0.1, 0.18], [0.2, 0.12, 0.2], [0.5, 0.08, 0.14]];
      for (const [y, h, a] of bands) { ctx.fillStyle = `rgba(150,96,60,${a})`; ctx.fillRect(-rr, y * rr - h * rr / 2, rr * 2, h * rr); }
      if (pl.n === 'Jupiter') { ctx.fillStyle = 'rgba(190,100,70,.5)'; ctx.beginPath(); ctx.ellipse(rr * 0.3, rr * 0.27, rr * 0.13, rr * 0.07, 0, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }
}
function drawDSOs(ctx, vp, Sx, hits, lim) {
  const toENU = (v) => mulM(E.M, v);
  const fade = clamp(E.dark * 1.15, 0.12, 1);
  const ngcLim = vp.fov > 150 ? 6.5 : vp.fov > 90 ? 8 : vp.fov > 45 ? 9.3 : 11;
  const labelAll = vp.fov < 140;
  for (const m of DSOS) {
    if (m.messier ? !S.L.dso : !S.L.ngc) continue;
    if (!m.messier) { if (m.type === 'dn' ? vp.fov > 70 : (m.mag == null || m.mag > ngcLim)) continue; }
    const e = toENU(m.v); if (e[2] < 0) continue;
    const p = camProj(vp, e); if (!onScreen(p, vp, 60)) continue;
    const type = m.type, mag = m.mag == null ? 10 : m.mag;
    const pxPerArcmin = p.sc * DEG / 60, minR = (m.messier ? 2.2 : 1.6) * Sx;
    const rx = Math.max(m.a / 2 * pxPerArcmin, minR), ry = Math.max(m.b / 2 * pxPerArcmin, minR * 0.6);
    let rot = 0;
    const pn = camProj(vp, toENU(towards(m.v, NCP, 0.003)));
    const east = norm(cross(NCP, m.v)), pe = camProj(vp, toENU(norm(m.v.map((x, i) => x + 0.003 * east[i]))));
    if (pn && pe) {
      const nx = pn.x - p.x, ny = pn.y - p.y, ex = pe.x - p.x, ey = pe.y - p.y, nl = Math.hypot(nx, ny) || 1, el2 = Math.hypot(ex, ey) || 1, pa = (m.pa || 0) * DEG;
      rot = Math.atan2(Math.cos(pa) * ny / nl + Math.sin(pa) * ey / el2, Math.cos(pa) * nx / nl + Math.sin(pa) * ex / el2);
    }
    const bright = clamp((11.5 - mag) / 7, 0.22, 1) * fade * (m.messier ? 1 : 0.8);
    ctx.save(); ctx.translate(p.x, p.y);
    if (type === 's' || type === 'e' || type === 'i' || type === 'gg') {
      ctx.rotate(rot); ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(250,240,222,${0.75 * bright})`); g.addColorStop(type === 'e' ? 0.35 : 0.18, `rgba(226,214,196,${0.32 * bright})`); g.addColorStop(1, 'rgba(200,190,180,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(226,214,196,${0.2 * bright})`; ctx.lineWidth = 0.8 * Sx / Math.max(ry / rx, 0.2); ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.stroke();
    } else if (type === 'dn') {
      ctx.rotate(rot); ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(0,0,0,${0.55 * fade})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill();
      ctx.setLineDash([2 * Sx, 3 * Sx]); ctx.strokeStyle = `rgba(150,140,130,${0.25 * fade})`; ctx.lineWidth = Sx / Math.max(ry / rx, 0.2); ctx.stroke(); ctx.setLineDash([]);
    } else if (type === 'sfr' || type === 'snr' || type === 'rn' || type === 'en' || type === 'pos') {
      ctx.rotate(rot); ctx.scale(1, ry / rx);
      const col = type === 'rn' ? [140, 170, 240] : type === 'pos' ? [210, 214, 228] : type === 'snr' ? [240, 150, 120] : [240, 128, 150];
      const a = type === 'pos' ? 0.16 : 0.5;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.15);
      g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a * bright})`);
      if (m.id === 'M42') g.addColorStop(0.15, `rgba(160,220,210,${0.45 * bright})`);
      g.addColorStop(0.55, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.35 * bright})`); g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx * 1.15, 0, 7); ctx.fill();
    } else if (type === 'pn') {
      const rr = Math.max(rx, 2.4 * Sx);
      ctx.strokeStyle = `rgba(130,220,200,${0.75 * bright})`; ctx.lineWidth = Math.max(Sx, rr * 0.35); ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.stroke();
    } else {
      const rr = Math.max(rx, type === 'gc' ? 3.2 * Sx : 4 * Sx);
      if (type === 'gc') { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 0.8); g.addColorStop(0, `rgba(255,236,200,${0.6 * bright})`); g.addColorStop(1, 'rgba(255,236,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.fill(); }
      ctx.fillStyle = type === 'gc' ? `rgba(255,240,215,${0.85 * bright})` : `rgba(220,230,255,${0.85 * bright})`;
      const dotR = Math.max(0.45 * Sx, Math.min(rr * 0.05, 1.4 * Sx));
      for (const q of m.pts) { ctx.globalAlpha = q[2]; ctx.beginPath(); ctx.arc(q[0] * rr, q[1] * rr, dotR, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (labelAll || mag < 5.5) {
      const txt = m.messier ? m.id : (vp.fov < 25 || (m.name && vp.fov < 90)) ? (m.name || m.id) : '';
      if (txt) queueLabel({text: txt, x: p.x + Math.max(rx, 4 * Sx) * 0.75 + 4 * Sx, y: p.y - Math.max(ry, 4 * Sx) * 0.6, align: 'left', font: `500 ${(m.messier ? 9.5 : 9) * Sx}px "IBM Plex Mono", monospace`, size: 9.5 * Sx, color: m.messier ? `rgba(190,200,220,${0.6 * fade + 0.12})` : `rgba(170,180,200,${0.48 * fade + 0.1})`, pri: m.messier ? 24 - mag : 10 - mag * 0.3});
    }
    if (hits) hits.push({x: p.x, y: p.y, r: Math.max(rx, 7 * Sx), kind: 'dso', ref: m, pri: (m.messier ? 8 : 5) - mag * 0.3});
  }
}
function selectionVec(sel) {
  if (!sel) return null;
  switch (sel.kind) {
    case 'star': return starVec(sel.ref);
    case 'planet': { const pl = E.planets.find((q) => q.n === sel.ref.n); return pl && pl.v; }
    case 'moon': return E.moon;
    case 'sun': return E.sun;
    case 'dso': return sel.ref.v;
    case 'con': return sel.ref.v;
    case 'jmoon': { const j = E.jmoons && E.jmoons.find((q) => q.n === sel.ref.n); return j && j.v; }
    case 'meteor': return sel.ref.s.v;
    case 'asterism': return sel.ref.v;
  }
  return null;
}
function drawReticle(ctx, vp, Sx) {
  if (S.sel.kind === 'con') return;
  const v = selectionVec(S.sel); if (!v) return;
  const p = camProj(vp, mulM(E.M, v)); if (!onScreen(p, vp, 0)) return;
  const r = 13 * Sx, l = 5 * Sx;
  ctx.strokeStyle = 'rgba(230,201,138,.9)'; ctx.lineWidth = 1.4 * Sx;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(p.x + sx * r, p.y + sy * (r - l)); ctx.lineTo(p.x + sx * r, p.y + sy * r); ctx.lineTo(p.x + sx * (r - l), p.y + sy * r); ctx.stroke(); }
  S.selScreen = {x: p.x / dpr, y: p.y / dpr};
}
function renderHud(ctx, vp, Sx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, vp.W, vp.H);
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) {
    const p = camProj(vp, enuDir(i * 45, -Math.max(2.2, Math.min(vp.fov / 40, 6))));
    if (!onScreen(p, vp, -4)) continue;
    const major = i % 2 === 0;
    ctx.font = `${major ? 600 : 500} ${(major ? 13 : 10.5) * Sx}px "IBM Plex Sans Condensed", sans-serif`;
    ctx.fillStyle = i === 0 ? 'rgba(230,140,110,.95)' : major ? 'rgba(201,166,94,.9)' : 'rgba(201,166,94,.55)';
    ctx.fillText(names[i], p.x, p.y);
  }
  if (S.mode !== 'zenith') {
    const z = camProj(vp, [0, 0, 1]);
    if (onScreen(z, vp, 0)) { ctx.strokeStyle = 'rgba(201,166,94,.4)'; ctx.lineWidth = Sx; ctx.beginPath(); ctx.moveTo(z.x - 5 * Sx, z.y); ctx.lineTo(z.x + 5 * Sx, z.y); ctx.moveTo(z.x, z.y - 5 * Sx); ctx.lineTo(z.x, z.y + 5 * Sx); ctx.stroke(); }
  }
  if (vp.proj === 2 && vp.fov < 20) { // eyepiece-style scale bar
    const deg = vp.fov > 8 ? 1 : vp.fov > 2 ? 0.5 : 0.1;
    const px = deg * DEG * vp.k, x0 = 24 * Sx, y0 = vp.H - 24 * Sx;
    ctx.strokeStyle = 'rgba(201,166,94,.7)'; ctx.lineWidth = Sx; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + px, y0); ctx.moveTo(x0, y0 - 4 * Sx); ctx.lineTo(x0, y0 + 4 * Sx); ctx.moveTo(x0 + px, y0 - 4 * Sx); ctx.lineTo(x0 + px, y0 + 4 * Sx); ctx.stroke();
    ctx.font = `${10 * Sx}px "IBM Plex Mono", monospace`; ctx.fillStyle = 'rgba(201,166,94,.8)'; ctx.textAlign = 'left'; ctx.fillText(deg >= 1 ? `${deg}°` : `${deg * 60}′`, x0 + px + 6 * Sx, y0);
  }
}
function renderTwinkle(ctx, now, W, H) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  const t = now / 1000;
  for (const s of LOWSTARS) {
    const i = s.i, ph = (i * 2654435761 % 1000) / 159.2, f1 = 0.7 + (i * 40503 % 997) / 623, f2 = 1.9 + (i * 9301 % 499) / 227;
    const f = 1 + s.amp * (0.6 * Math.sin(t * f1 * 3.1 + ph) + 0.4 * Math.sin(t * f2 * 4.7 + ph * 1.7));
    ctx.globalAlpha = clamp(s.al * f, 0, 1);
    const sz = s.size * (0.85 + 0.15 * f);
    ctx.drawImage(s.sp, s.x - sz / 2, s.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
}
function staticLowStars(ctx) { for (const s of LOWSTARS) { ctx.globalAlpha = s.al; ctx.drawImage(s.sp, s.x - s.size / 2, s.y - s.size / 2, s.size, s.size); } ctx.globalAlpha = 1; }

let lastMainMs = 0;
function renderFrame() {
  E = computeEphem(S.t);
  const vp = viewParams(cMain.width, cMain.height);
  if (GS) glDraw(GS, vp, 0, dpr); else if (fallback2D) fallbackSky(vp, fallback2D.sky);
  if (GG) { if (S.L.ground) glDraw(GG, vp, 1, dpr); else { GG.gl.clearColor(0, 0, 0, 0); GG.gl.clear(GG.gl.COLOR_BUFFER_BIT); } } else if (fallback2D) fallbackGround(vp, fallback2D.ground);
  const t0 = performance.now();
  renderMain(xMain, vp, dpr, {hits: true, collectLow: true, lowQ: (S.interacting > 0 || (S.playing && Math.abs(S.speed) >= 600)) && lastMainMs > 24});
  lastMainMs = performance.now() - t0;
  renderHud(xHud, vp, dpr);
  if (!(S.L.tw && !REDUCED)) xTw.clearRect(0, 0, cTw.width, cTw.height);
  const V = VIEWS[S.mode];
  const fovTxt = V.fov >= 10 ? V.fov.toFixed(0) + '°' : V.fov >= 1 ? V.fov.toFixed(1) + '°' : (V.fov * 60).toFixed(0) + '′';
  $('fovtag').textContent = `${['Zenith · fisheye', 'Horizon · stereographic', 'Optic · gnomonic'][V.proj]}   FOV ${fovTxt}   facing ${V.az.toFixed(0)}° az, ${V.alt.toFixed(0)}° alt   stars to mag ${Math.min(limitingMag(E.sunAlt, E.moonSky, V.fov), 8).toFixed(1)}`;
  if (!tip.hidden && S.sel && S.selScreen) placeTip(S.selScreen.x, S.selScreen.y);
}

// ================================================================== tooltip
const tip = $('tip');
const radecHours = (v) => { const [ra, dec] = vecRaDec(v); return [ra / 15, dec]; };
const conOf = (v) => { try { return A.Constellation(...radecHours(v)).name; } catch (e) { return ''; } };
function fmtRA(ra) { const h = ra / 15, H = Math.floor(h), m = (h - H) * 60, Mi = Math.floor(m), s = Math.round((m - Mi) * 60); return `${H}h ${String(Mi).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`; }
const fmtLy = (ly) => ly >= 1e6 ? `${(ly / 1e6).toFixed(ly >= 1e7 ? 0 : 1)} million ly` : `${Math.round(ly).toLocaleString('en-US')} ly`;
function describeSpect(sp, con) {
  if (!sp) return `A star in ${con || 'the sky'}.`;
  const col = {O: 'blue', B: 'blue-white', A: 'white', F: 'yellow-white', G: 'yellow', K: 'orange', M: 'red', C: 'deep-red carbon', S: 'red', W: 'Wolf–Rayet', D: 'white dwarf'}[sp[0]] || '';
  const lc = sp.slice(1);
  const cls = /IV/.test(lc) ? 'subgiant' : /III/.test(lc) ? 'giant' : /II/.test(lc) ? 'bright giant' : /I/.test(lc) ? 'supergiant' : /V/.test(lc) ? 'main-sequence star' : 'star';
  return `${/^[aeiou]/i.test(col) ? 'An' : 'A'} ${col} ${cls} (${sp.trim()}) in ${con || 'the sky'}.`;
}
function phaseName(a) {
  if (a < 6 || a > 354) return 'New Moon'; if (a < 84) return 'Waxing crescent'; if (a < 96) return 'First quarter';
  if (a < 174) return 'Waxing gibbous'; if (a < 186) return 'Full Moon'; if (a < 264) return 'Waning gibbous';
  if (a < 276) return 'Last quarter'; return 'Waning crescent';
}
// next rise/set for any fixed direction, by stepping the horizon matrix (10-minute resolution)
function nextCrossing(v, dir) {
  const obs = E.obs; let prev = altOf(mulM(E.M, v));
  for (let k = 1; k <= 145; k++) {
    const d = new Date(S.t.getTime() + k * 10 * 60000), a = altOf(mulM(rotMatrix(d, obs), v));
    if (dir > 0 ? prev < 0 && a >= 0 : prev >= 0 && a < 0) return d;
    prev = a;
  }
  return null;
}
function riseSetText(kind, ref, v) {
  try {
    const body = kind === 'planet' ? ref.n : kind === 'moon' ? 'Moon' : kind === 'sun' ? 'Sun' : null;
    const alt = altOf(mulM(E.M, v));
    const find = (dir) => body ? (A.SearchRiseSet(body, E.obs, dir, S.t, 1.1) || {}).date : nextCrossing(v, dir);
    if (alt >= 0) { const s = find(-1); return s ? ['Sets', relTime(s)] : ['Sets', 'never (circumpolar)']; }
    const r = find(+1); return r ? ['Rises', relTime(r)] : ['Rises', 'not in the next day'];
  } catch (e) { return null; }
}
function showTip(h) {
  const v = selectionVec(h); if (!v) return;
  let title = '', sub = '', rows = [], note = '';
  if (h.kind === 'star') {
    const s = starInfo(h.ref);
    title = starTitle(s);
    const bayer = s.desig ? `${s.desig} ${GEN[s.con] || s.con}` : '';
    sub = [s.proper && bayer, CONNAME[s.con] || conOf(v), s.hip ? 'HIP ' + s.hip : ''].filter(Boolean).join(' · ');
    rows.push(['Magnitude', s.mag.toFixed(2)]);
    if (s.vari) rows.push(['Variable', [s.vari[0], s.vari[1] != null ? `${s.vari[1].toFixed(1)}–${s.vari[2].toFixed(1)}` : ''].filter(Boolean).join(' · ')]);
    if (s.ly) rows.push(['Distance', fmtLy(s.ly)]);
    if (s.spect) rows.push(['Spectral type', s.spect]);
    rows.push(['Colour index B−V', s.ci.toFixed(2)]);
    note = STAR_NOTES[s.proper] || describeSpect(s.spect, CONNAME[s.con] || conOf(v));
  } else if (h.kind === 'planet') {
    const p = E.planets.find((q) => q.n === h.ref.n);
    title = p.n; sub = 'Planet · in ' + conOf(v);
    const ang = 2 * p.p.R / (p.dist * AU_KM) * RAD * 3600;
    rows.push(['Magnitude', p.mag.toFixed(2)], ['Apparent size', `${ang.toFixed(1)}″`], ['Distance', `${p.dist.toFixed(3)} AU`], ['Light time', `${(p.dist * 8.317).toFixed(1)} min`], ['Illuminated', `${(p.phase * 100).toFixed(0)}%`]);
    if (p.n === 'Saturn') rows.push(['Ring tilt', `${p.ring.toFixed(1)}°`]);
    try { rows.push(['Elongation', `${A.Elongation(p.n, S.t).elongation.toFixed(1)}° from Sun`]); } catch (e) {}
    note = PLANET_NOTES[p.n];
  } else if (h.kind === 'jmoon') {
    title = h.ref.n; sub = 'Galilean moon of Jupiter'; rows.push(['Magnitude', '≈ ' + h.ref.mag.toFixed(1)]);
    note = {Io: 'The most volcanically active body in the Solar System.', Europa: 'Ice-covered moon with a salty ocean beneath.', Ganymede: 'Largest moon in the Solar System, bigger than Mercury.', Callisto: 'Heavily cratered, with one of the oldest surfaces known.'}[h.ref.n];
  } else if (h.kind === 'moon') {
    title = 'The Moon'; sub = phaseName(E.moonPhaseAngle) + ' · in ' + conOf(v);
    const km = E.moonDist * AU_KM;
    rows.push(['Magnitude', E.moonMag.toFixed(1)], ['Illuminated', `${(E.moonIllum * 100).toFixed(0)}%`], ['Age', `${(E.moonPhaseAngle / 360 * 29.53).toFixed(1)} days`], ['Distance', `${Math.round(km).toLocaleString('en-US')} km`], ['Apparent size', `${(2 * 1737.4 / km * RAD * 60).toFixed(1)}′`]);
    note = 'The dark side glows faintly with earthshine: sunlight reflected off Earth.';
  } else if (h.kind === 'sun') {
    title = 'The Sun'; sub = 'Star · G2V'; rows.push(['Magnitude', '−26.7'], ['Distance', '8.3 light-minutes']); note = 'Never look at the Sun through binoculars or a telescope without a proper solar filter.';
  } else if (h.kind === 'dso') {
    const m = h.ref;
    title = m.messier ? m.id + (m.name ? ' · ' + m.name : '') : (m.name || m.id);
    sub = [TYPE_NAME[m.type] || 'Deep-sky object', m.messier ? m.desig : (m.name ? m.id : ''), conOf(v)].filter(Boolean).join(' · ');
    if (m.mag != null) rows.push(['Magnitude', m.mag.toFixed(1)]);
    rows.push(['Apparent size', m.a === m.b ? `${m.a}′` : `${m.a}′ × ${m.b}′`]);
    if (m.dist) rows.push(['Distance', fmtLy(m.dist)]);
    note = m.note || `${TYPE_NAME[m.type] || 'Deep-sky object'} in ${conOf(v)}${m.mag != null && m.mag > 7 ? ', a binocular or telescope target' : ''}.`;
  } else if (h.kind === 'con') {
    const c = h.ref; title = c.la; sub = `${c.id} · ${c.gen} · “${c.en}”`;
    note = 'IAU constellation. The figure is Stellarium’s modern sky-culture artwork.';
  } else if (h.kind === 'meteor') {
    const {s, days} = h.ref; title = s[0]; sub = 'Meteor shower radiant';
    rows.push(['Peak rate (ZHR)', `${s[1]} / hour`], ['Peak', days === 0 ? 'tonight' : days < 0 ? `in ${-days} days` : `${days} days ago`]);
    note = `Debris from ${s[7]}. Meteors appear all over the sky but trace back to this point; rates rise as the radiant climbs.`;
  }
  const enu = mulM(E.M, v);
  rows.push(['Altitude / azimuth', `${altOf(enu).toFixed(1)}° / ${azOf(enu).toFixed(1)}°`]);
  const [ra, dec] = vecRaDec(v);
  rows.push(['RA / Dec (J2000)', `${fmtRA(ra)} / ${dec >= 0 ? '+' : '−'}${Math.abs(dec).toFixed(2)}°`]);
  if (h.kind !== 'con') { const rs = riseSetText(h.kind, h.ref, v); if (rs) rows.push(rs); }
  tip.replaceChildren();
  const x = el('button', 'x', '×'); x.setAttribute('aria-label', 'Close'); x.onclick = closeTip;
  const dl = el('dl'); for (const [k, val] of rows) dl.append(el('dt', null, k), el('dd', null, val));
  const acts = el('div', 'acts');
  const center = el('button', null, 'Centre'); center.onclick = () => flyTo(v, h);
  const zoom = el('button', null, h.kind === 'con' ? 'Frame' : 'Zoom in'); zoom.onclick = () => flyTo(v, h, zoomFovFor(h));
  acts.append(center, zoom);
  tip.append(x, el('h3', null, title), el('div', 'sub', sub), dl, el('p', null, note || ''), acts);
  tip.hidden = false;
  S.sel = h; requestRender();
}
function placeTip(sx, sy) {
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let lx = sx + 20, ly = sy + 20;
  if (lx + tw > cssW - S.offX - 12) lx = sx - tw - 20;
  if (ly + th > cssH - 12) ly = sy - th - 20;
  tip.style.left = clamp(lx, 12, Math.max(12, cssW - tw - 12)) + 'px'; tip.style.top = clamp(ly, 64, Math.max(64, cssH - th - 12)) + 'px';
}
function closeTip() { tip.hidden = true; S.sel = null; S.selScreen = null; requestRender(); }
function zoomFovFor(h) {
  if (h.kind === 'planet') { const p = E.planets.find((q) => q.n === h.ref.n); const ang = 2 * p.p.R / (p.dist * AU_KM) * RAD; return clamp(ang * (p.n === 'Saturn' ? 16 : 14), 0.08, 3); }
  if (h.kind === 'jmoon') return 0.3;
  if (h.kind === 'moon') return 2.2;
  if (h.kind === 'dso') return clamp(h.ref.a / 60 * 4, 1, 40);
  if (h.kind === 'con') return 70;
  if (h.kind === 'star') return 8;
  return 30;
}
function hitTest(x, y) {
  let best = null, bd = 1e9;
  for (const h of HITS) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d > Math.max(h.r, 10 * dpr)) continue;
    const score = d - (h.pri || 0) * 1.2 * dpr;
    if (score < bd) { bd = score; best = h; }
  }
  return best;
}
function hoverText(h) {
  switch (h.kind) {
    case 'star': { const s = starInfo(h.ref); return [starTitle(s), `mag ${s.mag.toFixed(1)}`]; }
    case 'planet': return [h.ref.n, `mag ${h.ref.mag.toFixed(1)}`];
    case 'moon': return ['Moon', `${(E.moonIllum * 100).toFixed(0)}% lit`];
    case 'sun': return ['Sun', ''];
    case 'dso': return [h.ref.messier ? `${h.ref.id}${h.ref.name ? ' ' + h.ref.name : ''}` : (h.ref.name || h.ref.id), TYPE_NAME[h.ref.type] || ''];
    case 'jmoon': return [h.ref.n, 'moon of Jupiter'];
    case 'meteor': return [h.ref.s[0], 'radiant'];
    case 'con': return [h.ref.la, h.ref.en];
  }
  return ['', ''];
}

// ================================================================== camera animation
function flyTo(v, sel, fov) {
  const enu = mulM(E.M, v);
  if (S.mode === 'zenith') setMode(fov && fov < 40 ? 'optic' : 'horizon', true);
  if (fov != null && fov < VIEWS[S.mode].min) setMode('optic', true);
  const V = VIEWS[S.mode];
  const target = {az: azOf(enu), alt: clamp(altOf(enu), -20, 90), fov: clamp(fov != null ? fov : V.fov, V.min, V.max)};
  let daz = ((target.az - V.az + 540) % 360) - 180;
  S.fly = {t0: performance.now(), dur: REDUCED ? 1 : 900, from: {az: V.az, alt: V.alt, fov: V.fov}, daz, to: target};
  if (sel) { S.sel = sel; tip.hidden = true; S.flySel = sel; }
  if (altOf(enu) < 0) {
    const kind = sel && sel.kind, rs = riseSetText(kind, sel && sel.ref, v);
    toast(`${sel ? hoverText(sel)[0] : 'That object'} is below the horizon now${rs && rs[0] === 'Rises' ? ' · rises ' + rs[1] : ''}.`);
  }
}
function stepFly(now) {
  const f = S.fly; if (!f) return;
  const t = clamp((now - f.t0) / f.dur, 0, 1), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const V = VIEWS[S.mode];
  V.az = (f.from.az + f.daz * e + 360) % 360; V.alt = f.from.alt + (f.to.alt - f.from.alt) * e;
  V.fov = Math.exp(Math.log(f.from.fov) + (Math.log(f.to.fov) - Math.log(f.from.fov)) * e);
  S.interacting = 1; requestRender();
  if (t >= 1) { S.fly = null; S.interacting = 0; saveSoon(); if (S.flySel) { const h = S.flySel; S.flySel = null; setTimeout(() => { renderFrame(); showTip(h); }, 30); } }
}

// ================================================================== interaction
const sky = $('sky'), hoverEl = $('hover');
const ptrs = new Map(); let drag = null, pinch = null, moved = false, idleT = 0;
const interact = () => { S.interacting = 1; clearTimeout(idleT); idleT = setTimeout(() => { S.interacting = 0; requestRender(); }, 180); };
sky.addEventListener('pointerdown', (ev) => {
  if (!(ev.target === sky || ev.target instanceof HTMLCanvasElement)) return;
  sky.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, {x: ev.clientX, y: ev.clientY});
  moved = false; S.fly = null; hoverEl.hidden = true;
  if (ptrs.size === 1) { const V = VIEWS[S.mode]; drag = {x: ev.clientX, y: ev.clientY, az: V.az, alt: V.alt}; sky.classList.add('dragging'); }
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), fov: VIEWS[S.mode].fov}; drag = null; }
});
sky.addEventListener('pointermove', (ev) => {
  const r = sky.getBoundingClientRect();
  if (!ptrs.has(ev.pointerId)) {
    if (ev.pointerType !== 'mouse') return;
    const h = hitTest((ev.clientX - r.left) * dpr, (ev.clientY - r.top) * dpr);
    sky.classList.toggle('hot', !!h);
    if (h && h.kind !== 'con') { const [a, b] = hoverText(h); hoverEl.replaceChildren(el('b', null, a), document.createTextNode(b ? ' · ' + b : '')); hoverEl.style.left = (ev.clientX - r.left + 14) + 'px'; hoverEl.style.top = (ev.clientY - r.top - 28) + 'px'; hoverEl.hidden = false; }
    else hoverEl.hidden = true;
    return;
  }
  ptrs.set(ev.pointerId, {x: ev.clientX, y: ev.clientY});
  const V = VIEWS[S.mode];
  if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; V.fov = clamp(pinch.fov * pinch.d / Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1), V.min, V.max); moved = true; interact(); requestRender(); return; }
  if (!drag) return;
  const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
  if (Math.hypot(dx, dy) > 4) moved = true;
  if (!moved) return;
  if (S.mode === 'zenith') {
    const cx = r.left + (cssW - S.offX) / 2, cy = r.top + cssH / 2;
    const a0 = Math.atan2(drag.y - cy, drag.x - cx), a1 = Math.atan2(ev.clientY - cy, ev.clientX - cx);
    V.az = (drag.az + (a1 - a0) * RAD + 720) % 360;
  } else {
    const vp = viewParams(cssW, cssH), degPerPx = RAD / vp.k;
    V.az = (drag.az - dx * degPerPx / Math.max(Math.cos(V.alt * DEG), 0.25) + 720) % 360;
    V.alt = clamp(drag.alt + dy * degPerPx, -20, 90);
  }
  interact(); requestRender();
});
const endPtr = (ev) => {
  const wasTap = ptrs.size === 1 && !moved && ptrs.has(ev.pointerId);
  ptrs.delete(ev.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (ptrs.size === 0) { drag = null; sky.classList.remove('dragging'); saveSoon(); }
  if (wasTap && ev.type === 'pointerup') {
    const r = sky.getBoundingClientRect();
    const h = hitTest((ev.clientX - r.left) * dpr, (ev.clientY - r.top) * dpr);
    if (h) { showTip(h); S.selScreen = {x: h.x / dpr, y: h.y / dpr}; placeTip(S.selScreen.x, S.selScreen.y); } else closeTip();
  }
};
sky.addEventListener('pointerup', endPtr); sky.addEventListener('pointercancel', endPtr);
sky.addEventListener('pointerleave', () => { hoverEl.hidden = true; });
sky.addEventListener('wheel', (ev) => {
  ev.preventDefault(); const V = VIEWS[S.mode];
  V.fov = clamp(V.fov * Math.exp(ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0012)), V.min, V.max);
  if (S.mode === 'horizon' && V.fov <= V.min + 0.01 && ev.deltaY < 0) { VIEWS.optic.az = V.az; VIEWS.optic.alt = V.alt; VIEWS.optic.fov = 60; setMode('optic', true); }
  S.fly = null; interact(); requestRender(); saveSoon();
}, {passive: false});
window.addEventListener('keydown', (ev) => {
  const typing = ev.target.closest && ev.target.closest('input,select,textarea');
  if (ev.key === 'Escape') { closeTip(); $('layers').hidden = true; $('bLayers').setAttribute('aria-expanded', 'false'); $('help').hidden = true; $('results').hidden = true; if (typing) ev.target.blur(); return; }
  if (typing || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const V = VIEWS[S.mode]; let used = true;
  const step = Math.max(V.fov / 24, 0.05);
  switch (ev.key) {
    case 'ArrowLeft': V.az = (V.az - step + 360) % 360; break;
    case 'ArrowRight': V.az = (V.az + step) % 360; break;
    case 'ArrowUp': if (S.mode !== 'zenith') V.alt = clamp(V.alt + step, -20, 90); break;
    case 'ArrowDown': if (S.mode !== 'zenith') V.alt = clamp(V.alt - step, -20, 90); break;
    case '+': case '=': V.fov = clamp(V.fov / 1.2, V.min, V.max); break;
    case '-': case '_': V.fov = clamp(V.fov * 1.2, V.min, V.max); break;
    case ' ': togglePlay(); break;
    case '[': setTime(S.t.getTime() - HOUR); break;
    case ']': setTime(S.t.getTime() + HOUR); break;
    case 't': case 'T': $('tNow').click(); break;
    case '1': setMode('zenith'); break;
    case '2': setMode('horizon'); break;
    case '3': setMode('optic'); break;
    case '/': $('q').focus(); break;
    case 'l': case 'L': $('bLayers').click(); break;
    case 'n': case 'N': $('bRed').click(); break;
    case '?': $('help').hidden = !$('help').hidden; break;
    default: used = false;
  }
  if (used) { ev.preventDefault(); requestRender(); saveSoon(); }
});
function setMode(m, keepTip) {
  S.mode = m; if (!keepTip) closeTip();
  for (const [id, k] of [['pZenith', 'zenith'], ['pHorizon', 'horizon'], ['pOptic', 'optic']]) $(id).setAttribute('aria-pressed', String(k === m));
  requestRender(); saveSoon();
}
$('pZenith').onclick = () => setMode('zenith'); $('pHorizon').onclick = () => setMode('horizon'); $('pOptic').onclick = () => setMode('optic');
$('bLayers').onclick = () => { const L = $('layers'); L.hidden = !L.hidden; $('bLayers').setAttribute('aria-expanded', String(!L.hidden)); };
for (const k of Object.keys(S.L)) { const c = $('L_' + k); if (!c) continue; c.checked = !!S.L[k]; c.onchange = () => { S.L[k] = c.checked ? 1 : 0; requestRender(); saveSoon(); }; }
function syncBortle() {
  $('bortle').value = S.bortle; $('bortleN').textContent = S.bortle; $('bortleName').textContent = BORTLE[S.bortle][0];
  $('bortleLim').textContent = `naked eye ≈ mag ${BORTLE[S.bortle][1].toFixed(1)}`;
}
$('bortle').oninput = () => { S.bortle = +$('bortle').value; syncBortle(); requestRender(); saveSoon(); lastPanelSim = 0; };
$('bRed').onclick = () => { const on = !document.documentElement.classList.contains('red'); document.documentElement.classList.toggle('red', on); $('bRed').setAttribute('aria-pressed', String(on)); };
$('bHelp').onclick = () => { $('help').hidden = false; $('helpClose').focus(); };
$('helpClose').onclick = () => { $('help').hidden = true; };
$('help').onclick = (e) => { if (e.target === $('help')) $('help').hidden = true; };
document.addEventListener('pointerdown', (e) => {
  if (!$('layers').hidden && !e.target.closest('#layers,#bLayers')) { $('layers').hidden = true; $('bLayers').setAttribute('aria-expanded', 'false'); }
  if (!$('results').hidden && !e.target.closest('#searchWrap')) $('results').hidden = true;
});

// ================================================================== search
let INDEX = null;
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const GREEK_NAMES = {α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota', κ: 'kappa', λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi', ο: 'omicron', π: 'pi', ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon', φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega'};
function buildIndex() {
  const idx = [];
  const add = (label, kind, sel, keys, rank, sub) => idx.push({label, kind, sel, keys: keys.filter(Boolean).map(fold), rank, sub});
  add('Moon', 'Moon', {kind: 'moon'}, ['moon', 'luna'], 0, 'Earth’s satellite');
  add('Sun', 'Star', {kind: 'sun'}, ['sun', 'sol'], 0, 'Our star');
  PLANETS.forEach((p) => add(p.n, 'Planet', {kind: 'planet', ref: {n: p.n}}, [p.n], 0, 'Planet'));
  ['Io', 'Europa', 'Ganymede', 'Callisto'].forEach((n) => add(n, 'Moon of Jupiter', {kind: 'jmoon', ref: {n}}, [n], 3));
  SD.cons.forEach((c) => add(c.la, 'Constellation', {kind: 'con', ref: c}, [c.la, c.en, c.id, c.gen], 1, `${c.id} · ${c.en}`));
  for (let i = 0; i < NB; i++) {
    const s = SD.stars[i]; if (!s[5] && !(s[6] && s[2] < 4.5)) continue;
    const g = s[6] && GREEK_NAMES[s[6][0]];
    const bayer = s[6] ? `${s[6]} ${GEN[s[7]] || s[7]}` : '';
    add(s[5] || bayer, 'Star', {kind: 'star', ref: i}, [s[5], bayer, g && `${g} ${GEN[s[7]] || ''}`, g && `${g} ${s[7]}`, s[4] && 'hip ' + s[4]], 2 + s[2] / 10, `mag ${s[2].toFixed(1)} · ${CONNAME[s[7]] || s[7]}`);
  }
  DSOS.forEach((m) => {
    if (!m.messier && !m.name && (m.mag == null || m.mag > 9)) return;
    const label = m.messier ? `${m.id}${m.name ? ' · ' + m.name : ''}` : (m.name ? `${m.name}` : m.id);
    add(label, TYPE_NAME[m.type] || 'Deep sky', {kind: 'dso', ref: m}, [m.id, m.id.replace(' ', ''), m.name, m.desig, m.desig && m.desig.replace(' ', '')], m.messier ? 1.5 : 2.5, m.messier ? (TYPE_NAME[m.type] || '') : `${m.id} · ${TYPE_NAME[m.type] || ''}`);
  });
  SD.asterisms.forEach((a) => add(a.n, 'Asterism', {kind: 'asterism', ref: a}, [a.n], 2.2));
  SHOWERS.forEach((s) => add(s[0], 'Meteor shower', {kind: 'meteor', ref: {s, days: 0}}, [s[0]], 2.4, 'Radiant'));
  return idx;
}
function search(q) {
  INDEX = INDEX || buildIndex();
  const f = fold(q.trim()); if (!f) return [];
  const out = [];
  for (const it of INDEX) {
    let score = 99;
    for (const k of it.keys) { if (k === f) score = Math.min(score, 0); else if (k.startsWith(f)) score = Math.min(score, 1); else if (k.includes(' ' + f)) score = Math.min(score, 2); else if (f.length > 2 && k.includes(f)) score = Math.min(score, 3); }
    if (score < 99) out.push([score * 10 + it.rank, it]);
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, 9).map((x) => x[1]);
}
let resSel = 0, resItems = [];
const qEl = $('q'), resEl = $('results');
function renderResults() {
  resEl.replaceChildren();
  if (!qEl.value.trim()) { resEl.hidden = true; return; }
  if (!resItems.length) { const li = el('li', 'empty', 'No match. Try a name, “M31”, “NGC 869” or a constellation.'); resEl.append(li); resEl.hidden = false; return; }
  resItems.forEach((it, i) => {
    const li = el('li'); li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === resSel));
    li.append(el('span', 'n', it.label), el('span', 'k', it.sub || it.kind));
    li.onpointerdown = (e) => { e.preventDefault(); choose(it); };
    resEl.append(li);
  });
  resEl.hidden = false;
}
function choose(it) {
  resEl.hidden = true; qEl.value = ''; qEl.blur();
  if (it.kind === 'Asterism') { flyTo(it.sel.ref.v, null, 45); return; }
  if (it.sel.kind === 'meteor') { const act = activeShowers(S.t).find((a) => a.s === it.sel.ref.s); it.sel.ref.days = act ? act.days : 0; }
  const v = selectionVec(it.sel); if (!v) return;
  flyTo(v, it.sel, it.sel.kind === 'con' ? 75 : it.sel.kind === 'dso' ? zoomFovFor(it.sel) * 3 : it.sel.kind === 'planet' ? 20 : it.sel.kind === 'jmoon' ? 0.4 : 40);
}
qEl.addEventListener('input', () => { resItems = search(qEl.value); resSel = 0; renderResults(); });
qEl.addEventListener('focus', () => { if (qEl.value) renderResults(); });
qEl.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { resSel = Math.min(resSel + 1, resItems.length - 1); renderResults(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { resSel = Math.max(resSel - 1, 0); renderResults(); e.preventDefault(); }
  else if (e.key === 'Enter' && resItems[resSel]) { choose(resItems[resSel]); e.preventDefault(); }
});

// ================================================================== site & time controls
const sel = $('siteSel');
SITES.forEach((s, i) => sel.append(new Option(s.name, i)));
sel.append(new Option('Custom location…', 'custom'));
try { if (Intl.supportedValuesOf) { const dl = $('tzList'); for (const z of Intl.supportedValuesOf('timeZone')) dl.append(new Option(z)); } } catch (e) {}
function syncSiteSel() {
  const i = SITES.findIndex((s) => s.name === S.site.name);
  sel.value = i >= 0 ? i : 'custom'; $('custom').hidden = i >= 0;
  if (i < 0) { $('cLat').value = S.site.lat; $('cLon').value = S.site.lon; $('cTz').value = S.site.tz; }
}
sel.onchange = () => {
  if (sel.value === 'custom') { $('custom').hidden = false; $('cLat').value = S.site.lat; $('cLon').value = S.site.lon; $('cTz').value = S.site.tz; $('cLat').focus(); return; }
  $('custom').hidden = true; setSite(SITES[+sel.value]);
};
$('cGo').onclick = () => {
  const lat = parseFloat($('cLat').value), lon = parseFloat($('cLon').value), tz = $('cTz').value.trim() || 'UTC';
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) { toast('Latitude must be between −90 and 90, longitude between −180 and 180.'); return; }
  if (!validTz(tz)) { toast(`“${tz}” is not a time zone this browser knows. Use a name like Europe/Berlin.`); return; }
  setSite({name: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`, lat, lon, h: 0, tz});
};
function setSite(s) { S.site = s; S.t = tonight22(s, S.t); arcCache.key = null; evKey = null; nightKey = null; tlCache.clear(); requestRender(); tlDirty = true; save(); syncSiteSel(); lastPanelSim = 0; }
function setTime(d) { S.t = new Date(d); requestRender(); tlDirty = true; }
function togglePlay() { S.playing = !S.playing; $('play').textContent = S.playing ? '❚❚' : '▶'; $('play').setAttribute('aria-label', S.playing ? 'Pause time' : 'Play time'); }
$('play').onclick = togglePlay;
$('speed').onchange = () => { S.speed = +$('speed').value; if (!S.playing) togglePlay(); };
$('tNow').onclick = () => { setTime(new Date()); S.speed = 1; $('speed').value = '1'; if (!S.playing) togglePlay(); };
$('tTonight').onclick = () => setTime(tonight22(S.site, S.t));
$('tDm').onclick = () => setTime(S.t.getTime() - DAY); $('tDp').onclick = () => setTime(S.t.getTime() + DAY);
$('tHm').onclick = () => setTime(S.t.getTime() - HOUR); $('tHp').onclick = () => setTime(S.t.getTime() + HOUR);
$('tInput').onchange = () => { const m = /^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/.exec($('tInput').value); if (m) setTime(siteDate(S.site.tz, +m[1], +m[2], +m[3], +m[4], +m[5])); };
function syncTimeInput() {
  if (document.activeElement === $('tInput')) return;
  const p = tzParts(S.site.tz, S.t), z = (n) => String(n).padStart(2, '0');
  $('tInput').value = `${p.y}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`;
}
$('sheetToggle').onclick = () => { const c = $('panel').classList.toggle('collapsed'); $('sheetToggle').setAttribute('aria-expanded', String(!c)); $('sheetToggle').textContent = c ? 'Tonight' : 'Hide'; };
if (matchMedia('(max-width:760px)').matches) $('panel').classList.add('collapsed');
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3600); }

// ================================================================== tonight ledger
let lastPanel = 0, lastPanelSim = 0;
function updatePanel(force) {
  const now = performance.now();
  if (!force && now - lastPanel < 500 && !(Math.abs(S.t - lastPanelSim) > 5 * 60000 && now - lastPanel > 150)) return;
  lastPanel = now; lastPanelSim = S.t.getTime();
  const sections = [panelHead, panelNight, panelMoon, panelPlanets, panelBest, panelRiseSet, panelConj];
  for (const f of sections) { try { f(); } catch (e) { warnOnce('panel:' + f.name, e); } }
  scheduleEvents();
}
function panelHead() {
  $('clock').textContent = hm(S.t);
  $('clockdate').textContent = fmt(S.site.tz, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}).format(S.t) + ' · ' + tzAbbr();
  syncTimeInput();
  const sa = E.sunAlt;
  const [cls, txt] = sa > 0 ? ['day', 'Daylight'] : sa > -6 ? ['twi', 'Civil twilight'] : sa > -12 ? ['twi', 'Nautical twilight'] : sa > -18 ? ['twi', 'Astronomical twilight'] : E.moonAlt > 0 && E.moonIllum > 0.3 ? ['dark', 'Dark, moonlit'] : ['dark', 'Full darkness'];
  $('darkChip').className = 'chip ' + cls; $('darkChip').lastElementChild.textContent = txt; $('darkChip').title = `Sun ${sa.toFixed(1)}° altitude`;
}
// the night containing the current time: from local noon to the next local noon
let nightKey = null, NIGHT = null;
function computeNight() {
  const p = tzParts(S.site.tz, S.t);
  let noon = siteDate(S.site.tz, p.y, p.mo, p.d, 12, 0); if (S.t < noon) noon = new Date(noon.getTime() - DAY);
  const key = S.site.lat + ',' + S.site.lon + ',' + noon.getTime();
  if (key === nightKey) return NIGHT;
  nightKey = key;
  const obs = observer(), find = (dir, alt) => { try { const r = A.SearchAltitude('Sun', obs, dir, noon, 1, alt); return r && r.date; } catch (e) { return null; } };
  const set = find(-1, -0.833), dusk = find(-1, -18), dawn = dusk ? find(+1, -18) : null, rise = find(+1, -0.833);
  // per-10-minute samples for the bar: sun altitude and moon altitude
  const samples = [];
  for (let k = 0; k <= 144; k++) {
    const d = new Date(noon.getTime() + k * 10 * 60000), M = rotMatrix(d, obs);
    samples.push([d, altOf(mulM(M, bodyEq('Sun', d, obs).v)), altOf(mulM(M, bodyEq('Moon', d, obs).v))]);
  }
  let mfStart = null, mfMins = 0, best = [null, 0], runStart = null;
  for (const [d, s, m] of samples) {
    const ok = s < -18 && m < 0;
    if (ok) { if (!runStart) runStart = d; mfMins += 10; if (d - runStart >= best[1]) best = [runStart, d - runStart, d]; } else runStart = null;
  }
  return (NIGHT = {noon, set, dusk, dawn, rise, samples, moonFree: best[0] ? {from: best[0], to: best[2], mins: mfMins} : null});
}
function panelNight() {
  const N = computeNight();
  const kv = $('nightKv'); kv.replaceChildren();
  const cell = (k, d) => { const c = el('div'); c.append(el('span', null, k), el('b', null, d ? hm(d) : '—')); kv.append(c); };
  cell('Sunset', N.set); cell('Dark', N.dusk); cell('Dawn', N.dawn); cell('Sunrise', N.rise);
  $('nightNote').textContent = N.dusk ? `${dayLabel(N.dusk)} night` : 'no astronomical darkness';
  const mf = $('mfree'); mf.replaceChildren();
  if (N.moonFree) { const h = Math.floor(N.moonFree.mins / 60), mi = N.moonFree.mins % 60; mf.append(document.createTextNode('Moon-free darkness: '), el('b', null, `${hm(N.moonFree.from)}–${hm(N.moonFree.to)}`), document.createTextNode(` · ${h} h ${String(mi).padStart(2, '0')} m in total`)); }
  else mf.textContent = N.dusk ? 'The Moon is up for the whole dark window tonight.' : 'The Sun never gets 18° below the horizon tonight.';
  const cv = $('nightCv'), r = cv.getBoundingClientRect(), W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const x = cv.getContext('2d'); x.clearRect(0, 0, W, H);
  const span = DAY, X = (d) => (d - N.noon) / span * W;
  for (let i = 0; i < N.samples.length - 1; i++) {
    const [d, s, m] = N.samples[i], x0 = X(d), x1 = X(N.samples[i + 1][0]);
    x.fillStyle = s > 0 ? '#344a6c' : s > -6 ? '#5a3a3a' : s > -12 ? '#33294a' : s > -18 ? '#1d1d3a' : m > 0 ? '#28303f' : '#080a16';
    x.fillRect(Math.floor(x0), 0, Math.ceil(x1) - Math.floor(x0), H);
  }
  const nx = X(S.t); x.fillStyle = 'rgba(230,201,138,.95)'; x.fillRect(nx - dpr, 0, 2 * dpr, H);
  x.font = `${9 * dpr}px "IBM Plex Mono", monospace`; x.fillStyle = 'rgba(141,147,166,.8)'; x.textBaseline = 'middle';
  x.textAlign = 'left'; x.fillText('noon', 4 * dpr, H / 2); x.textAlign = 'right'; x.fillText('noon', W - 4 * dpr, H / 2);
}
function panelMoon() {
  $('moonPh').textContent = phaseName(E.moonPhaseAngle);
  const kv = $('moonKv'); kv.replaceChildren();
  const add = (k, v) => kv.append(el('dt', null, k), el('dd', null, v));
  add('Illuminated', `${(E.moonIllum * 100).toFixed(0)}%`);
  add('Age', `${(E.moonPhaseAngle / 360 * 29.53).toFixed(1)} d`);
  add('Altitude', `${E.moonAlt.toFixed(0)}°`);
  try {
    const r = A.SearchRiseSet('Moon', E.obs, +1, S.t, 1.2), s = A.SearchRiseSet('Moon', E.obs, -1, S.t, 1.2);
    if (r) add('Rises', relTime(r.date)); if (s) add('Sets', relTime(s.date));
  } catch (e) {}
  const c = $('moonCv'), x = c.getContext('2d'); x.clearRect(0, 0, 128, 128);
  let ang = E.moonPhaseAngle < 180 ? 0 : Math.PI; if (S.site.lat < 0) ang = Math.PI - ang;
  drawGlow(x, 64, 64, 62, [200, 210, 235], 0.12 + 0.18 * E.moonIllum);
  drawMoonDisc(x, 64, 64, 40, ang, E.moonPA);
}
function panelPlanets() {
  const t = $('planetTable'); t.replaceChildren();
  for (const p of E.planets) {
    const tr = el('tr'), b = el('button'), i = el('i'); i.style.background = `rgb(${p.c})`;
    b.append(i, document.createTextNode(p.n)); b.onclick = () => flyTo(p.v, {kind: 'planet', ref: {n: p.n}}, 20);
    const alt = altOf(mulM(E.M, p.v));
    let status;
    try {
      if (alt > 0) { const s = A.SearchRiseSet(p.n, E.obs, -1, S.t, 1.1); status = el('span', 'up', `up ${alt.toFixed(0)}°${s ? ' · sets ' + hm(s.date) : ''}`); }
      else { const r = A.SearchRiseSet(p.n, E.obs, +1, S.t, 1.1); status = el('span', 'dn', r ? `rises ${relTime(r.date)}` : 'below horizon'); }
    } catch (e) { status = el('span', 'dn', alt > 0 ? 'up' : 'down'); }
    const c1 = el('td'); c1.append(b);
    const con = (() => { try { return A.Constellation(...radecHours(p.v)).symbol; } catch (e) { return ''; } })();
    const c4 = el('td'); c4.append(status);
    tr.append(c1, el('td', null, (p.mag >= 0 ? ' ' : '') + p.mag.toFixed(1)), el('td', null, con), c4);
    t.append(tr);
  }
}
function panelBest() {
  const ul = $('best'); ul.replaceChildren();
  if (E.sunAlt > -10) { ul.append(el('li', 'empty', 'Wait for darkness; the list fills in once the Sun is 10° down.')); return; }
  const lim = E.lim0, cand = [];
  for (const m of DSOS) {
    if (m.mag == null || m.type === 'dn' || (!m.messier && !m.name)) continue;
    const alt = altOf(mulM(E.M, m.v)); if (alt < 25) continue;
    const eff = m.mag + 0.28 * (airmass(Math.sin(alt * DEG)) - 1) + Math.log10(Math.max(m.a * m.b, 1)) * 0.6; // big faint things are harder
    if (eff > lim + 3.5) continue;
    cand.push([eff - alt / 40 - (m.messier ? 0.3 : 0), m, alt]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  const seen = new Set();
  for (const [, m, alt] of cand) {
    const key = m.name || m.id; if (seen.has(key)) continue; seen.add(key);
    const li = el('li'), b = el('button');
    const left = el('div'); left.append(el('div', 't', m.messier ? `${m.id}${m.name ? ' · ' + m.name : ''}` : m.name), el('div', 's', `${TYPE_NAME[m.type] || ''} · mag ${m.mag.toFixed(1)}${m.mag <= lim - 0.5 ? ' · naked eye' : m.mag <= 9 ? ' · binoculars' : ' · telescope'}`));
    b.append(left, el('div', 'a', `${alt.toFixed(0)}° ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(azOf(mulM(E.M, m.v)) / 45) % 8]}`));
    b.onclick = () => flyTo(m.v, {kind: 'dso', ref: m}, zoomFovFor({kind: 'dso', ref: m}) * 3);
    li.append(b); ul.append(li);
    if (seen.size >= 6) break;
  }
  if (!seen.size) ul.append(el('li', 'empty', 'Nothing bright is high enough right now.'));
  const sh = activeShowers(S.t);
  for (const {s, days} of sh) {
    const alt = altOf(mulM(E.M, s.v)), li = el('li'), b = el('button');
    const left = el('div'); left.append(el('div', 't', `${s[0]} meteors`), el('div', 's', `${days === 0 ? 'Peak tonight' : days < 0 ? `Peak in ${-days} d` : `${days} d after peak`} · ZHR ${s[1]} · radiant ${alt > 0 ? alt.toFixed(0) + '° up' : 'below horizon'}`));
    b.append(left, el('div', 'a', 'shower')); b.onclick = () => flyTo(s.v, {kind: 'meteor', ref: {s, days}}, 70);
    li.append(b); ul.append(li);
  }
}
function panelRiseSet() {
  const M1 = rotMatrix(new Date(S.t.getTime() + 2 * HOUR), E.obs), rising = [], setting = [];
  for (const c of SD.cons) {
    const a0 = mulM(E.M, c.v)[2], a1 = mulM(M1, c.v)[2];
    if ((a0 < 0) === (a1 < 0)) continue;
    (a1 > a0 ? rising : setting).push([c.la, new Date(S.t.getTime() + a0 / (a0 - a1) * 2 * HOUR)]);
  }
  const fill = (ul, arr) => { ul.replaceChildren(); if (!arr.length) { ul.append(el('li', 'empty', 'None')); return; } arr.sort((a, b) => a[1] - b[1]).slice(0, 7).forEach(([n, w]) => { const li = el('li'); li.append(el('span', null, n), el('span', 'num', hm(w))); ul.append(li); }); };
  fill($('rising'), rising); fill($('setting'), setting);
}
function panelConj() {
  const cj = $('conj'); cj.replaceChildren(); let n = 0;
  const item = (p, other, d, extra) => { const li = el('li'), i = el('i'); i.style.background = `rgb(${p.c})`; const div = el('div'); div.append(el('b', null, p.n), el('span', 'num', ` ${d.toFixed(1)}° `), document.createTextNode('from ' + other), el('div', 's', extra)); div.lastChild.style.cssText = 'font-size:11.5px;color:var(--dim)'; li.append(i, div); cj.append(li); n++; };
  for (const p of E.planets) {
    const below = altOf(mulM(E.M, p.v)) < 0 ? ' · below the horizon now' : '';
    for (const i of namedBright) { const d = sepDeg(p.v, starVec(i)); if (d <= 5) item(p, SD.stars[i][5], d, `mag ${SD.stars[i][2].toFixed(1)} · ${CONNAME[SD.stars[i][7]] || ''}${below}`); }
    for (const q of E.planets) if (q.n > p.n) { const d = sepDeg(p.v, q.v); if (d <= 5) item(p, q.n, d, 'planet pair' + below); }
  }
  if (!n) cj.append(el('li', 'empty', 'No planet is within 5° of a named star right now.'));
}
const tzAbbr = () => { try { return fmt(S.site.tz, {timeZoneName: 'short'}).formatToParts(S.t).find((x) => x.type === 'timeZoneName').value; } catch (e) { return S.site.tz; } };

// ================================================================== 7-day events
let evKey = null, evTimer = 0;
function scheduleEvents() {
  const key = S.site.lat + ',' + S.site.lon + ',' + Math.floor(S.t.getTime() / (6 * HOUR));
  if (key === evKey) return; evKey = key;
  clearTimeout(evTimer); evTimer = setTimeout(() => { try { computeEvents(); } catch (e) { warnOnce('events', e); $('events').replaceChildren(el('li', 'empty', 'Events could not be computed for this date.')); } }, 80);
}
function computeEvents() {
  const t0 = S.t, t1 = new Date(t0.getTime() + 7 * DAY), obs = observer(), ev = [];
  const inWin = (d) => d && d >= t0 && d <= t1;
  const tryAdd = (fn) => { try { fn(); } catch (e) { warnOnce('event', e); } };
  tryAdd(() => { let q = A.SearchMoonQuarter(t0); for (let k = 0; k < 4 && q.time.date <= t1; k++) { ev.push({d: q.time.date, t: ['New Moon', 'First quarter Moon', 'Full Moon', 'Last quarter Moon'][q.quarter], s: q.quarter === 0 ? 'Darkest skies of the month' : q.quarter === 2 ? 'Moon up all night' : 'Half-lit Moon', tag: 'Moon'}); q = A.NextMoonQuarter(q); } });
  tryAdd(() => { const a = A.SearchLunarApsis(t0); if (inWin(a.time.date)) ev.push({d: a.time.date, t: a.kind === 0 ? 'Moon at perigee' : 'Moon at apogee', s: `${Math.round(a.dist_km).toLocaleString('en-US')} km from Earth`, tag: 'Moon'}); });
  for (const n of ['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']) tryAdd(() => { const o = A.SearchRelativeLongitude(n, 180, t0); if (inWin(o.date)) ev.push({d: o.date, t: `${n} at opposition`, s: 'Closest and brightest; up all night', tag: 'Planet'}); });
  for (const n of ['Mercury', 'Venus']) tryAdd(() => { const e = A.SearchMaxElongation(n, t0); if (inWin(e.time.date)) ev.push({d: e.time.date, t: `${n} at greatest elongation`, s: `${e.elongation.toFixed(1)}° from the Sun, ${e.visibility} sky`, tag: 'Planet'}); });
  tryAdd(() => { const le = A.SearchLunarEclipse(t0); if (inWin(le.peak.date)) ev.push({d: le.peak.date, t: `${le.kind[0].toUpperCase() + le.kind.slice(1)} lunar eclipse`, s: 'Time of greatest eclipse', tag: 'Eclipse'}); });
  tryAdd(() => { const se = A.SearchLocalSolarEclipse(t0, obs); if (inWin(se.peak.time.date)) ev.push({d: se.peak.time.date, t: `${se.kind[0].toUpperCase() + se.kind.slice(1)} solar eclipse from here`, s: `${(se.obscuration * 100).toFixed(0)}% of the Sun covered · use a solar filter`, tag: 'Eclipse'}); });
  const yr = tzParts(S.site.tz, t0).y;
  for (const y of [yr, yr + 1]) for (const s of SHOWERS) {
    const dt = siteDate(S.site.tz, y, s[5][0], s[5][1], 2, 0);
    if (inWin(dt)) ev.push({d: dt, t: `${s[0]} peak`, s: `Up to ~${s[1]} meteors/hour · from ${s[7]}`, tag: 'Meteors', noTime: true});
  }
  // the Moon against bright stars and planets, topocentric, in 20-minute steps
  const cand = [];
  for (let i = 0; i < NB; i++) { const s = SD.stars[i]; if (s[2] > 4.5) break; const v = starVec(i); if (Math.abs(Math.asin(dot(v, ECL_N)) * RAD) < 7) cand.push({name: s[5] || `${s[6]} ${GEN[s[7]] || s[7]}`, v, mag: s[2]}); }
  const STEP = 20 * 60000, steps = Math.ceil(7 * DAY / STEP), moonAt = [], plAt = {};
  for (let k = 0; k <= steps; k++) {
    const d = new Date(t0.getTime() + k * STEP);
    moonAt.push(bodyEq('Moon', d, obs).v);
    if (k % 3 === 0) for (const p of PLANETS) (plAt[p.n] = plAt[p.n] || []).push(bodyEq(p.n, d, obs).v);
  }
  const visible = (d, v) => { const M = rotMatrix(d, obs); const alt = mulM(M, v)[2], sun = mulM(M, bodyEq('Sun', d, obs).v)[2]; return alt > 0.05 ? (sun < -0.1 ? 'visible from this site' : 'in daylight here') : 'below the horizon here'; };
  for (const c of cand) {
    let inside = false;
    for (let k = 0; k <= steps; k++) {
      const s = sepDeg(moonAt[k], c.v);
      if (s < 0.27 && !inside) { inside = true; const d = new Date(t0.getTime() + k * STEP); ev.push({d, t: `Moon occults ${c.name}`, s: `mag ${c.mag.toFixed(1)} star disappears behind the Moon · ${visible(d, c.v)}`, tag: 'Occultation'}); }
      if (s > 0.35) inside = false;
    }
  }
  for (const p of PLANETS) {
    const arr = plAt[p.n]; let prev = 999, dir = -1;
    for (let k = 0; k < arr.length; k++) {
      const s = sepDeg(moonAt[k * 3], arr[k]);
      if (s > prev && dir < 0 && prev < 4.5) { const d = new Date(t0.getTime() + (k - 1) * 3 * STEP); ev.push(prev < 0.3 ? {d, t: `Moon occults ${p.n}`, s: visible(d, arr[k - 1]), tag: 'Occultation'} : {d, t: `Moon ${prev.toFixed(1)}° from ${p.n}`, s: visible(d, arr[k - 1]), tag: 'Conjunction'}); }
      dir = s > prev ? 1 : -1; prev = s;
    }
  }
  for (let i = 0; i < PLANETS.length; i++) for (let j = i + 1; j < PLANETS.length; j++) {
    const a = plAt[PLANETS[i].n], b = plAt[PLANETS[j].n]; let prev = 999, dir = -1;
    for (let k = 0; k < a.length; k++) { const s = sepDeg(a[k], b[k]); if (s > prev && dir < 0 && prev < 3) ev.push({d: new Date(t0.getTime() + (k - 1) * 3 * STEP), t: `${PLANETS[i].n} and ${PLANETS[j].n} ${prev.toFixed(1)}° apart`, s: 'Planetary conjunction', tag: 'Conjunction'}); dir = s > prev ? 1 : -1; prev = s; }
  }
  ev.sort((a, b) => a.d - b.d);
  const ul = $('events'); ul.replaceChildren();
  if (!ev.length) { ul.append(el('li', 'empty', 'Nothing notable in the next seven days.')); return; }
  for (const e of ev) {
    const li = el('li'), b = el('button');
    const d = el('div', 'd', dayLabel(e.d)); d.append(el('small', null, e.noTime ? dateLabel(e.d) : `${dateLabel(e.d)} ${hm(e.d)}`));
    const w = el('div'), t = el('div', 't', e.t); t.append(el('span', 'tag', e.tag)); w.append(t, el('div', 's', e.s));
    b.append(d, w); b.onclick = () => { setTime(e.d); if (S.playing) togglePlay(); evKey = null; };
    li.append(b); ul.append(li);
  }
}

// ================================================================== timeline
const tlCv = $('tlCv'), tlX = tlCv.getContext('2d');
let tlDirty = true; const tlCache = new Map();
function altsAt(idx) {
  let v = tlCache.get(idx); if (v) return v;
  const d = new Date(idx * 15 * 60000), obs = E ? E.obs : observer(), M = rotMatrix(d, obs);
  v = [altOf(mulM(M, bodyEq('Sun', d, obs).v)), altOf(mulM(M, bodyEq('Moon', d, obs).v))];
  if (tlCache.size > 4000) tlCache.clear();
  tlCache.set(idx, v); return v;
}
function drawTimeline() {
  const r = $('tlStrip').getBoundingClientRect(), W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
  if (tlCv.width !== W || tlCv.height !== H) { tlCv.width = W; tlCv.height = H; }
  const x = tlX; x.clearRect(0, 0, W, H);
  const span = 24 * HOUR, t = S.t.getTime(), t0 = t - span / 2;
  const X = (ms) => (ms - t0) / span * W, mid = H * 0.58, amp = H * 0.42, Y = (alt) => mid - alt / 90 * amp;
  const q0 = Math.floor(t0 / 900000) - 1, q1 = Math.ceil((t0 + span) / 900000) + 1;
  const pts = []; for (let q = q0; q <= q1; q++) pts.push([X(q * 900000), ...altsAt(q)]);
  const shade = (s) => s > 0 ? 'rgba(80,120,180,.30)' : s > -6 ? 'rgba(150,90,80,.26)' : s > -12 ? 'rgba(70,60,110,.22)' : s > -18 ? 'rgba(40,40,80,.18)' : null;
  for (let i = 0; i < pts.length - 1;) {
    const c = shade(pts[i][1]); let j = i + 1;
    while (j < pts.length - 1 && shade(pts[j][1]) === c) j++;
    if (c) { x.fillStyle = c; x.fillRect(Math.round(pts[i][0]), 0, Math.round(pts[j][0]) - Math.round(pts[i][0]), H); }
    i = j;
  }
  x.strokeStyle = 'rgba(201,166,94,.25)'; x.lineWidth = dpr; x.beginPath(); x.moveTo(0, mid); x.lineTo(W, mid); x.stroke();
  x.font = `${10 * dpr}px "IBM Plex Mono", monospace`; x.textAlign = 'center'; x.textBaseline = 'top';
  const off = tzOffset(S.site.tz, S.t) * 60000;
  for (let h = Math.floor((t0 + off) / HOUR); h * HOUR - off < t0 + span; h++) {
    const ms = h * HOUR - off, px = X(ms), lh = ((h % 24) + 24) % 24;
    x.fillStyle = 'rgba(201,166,94,.35)'; x.fillRect(px, mid - 3 * dpr, dpr, 6 * dpr);
    if (lh % 3 === 0) { x.fillStyle = lh === 0 ? 'rgba(230,201,138,.85)' : 'rgba(141,147,166,.8)'; x.fillText(lh === 0 ? dateLabel(new Date(ms + HOUR)) : String(lh).padStart(2, '0'), px, 3 * dpr); }
  }
  const track = (k, col, w) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], Y(p[k])) : x.moveTo(p[0], Y(p[k])))); x.stroke(); };
  x.save(); x.beginPath(); x.rect(0, 0, W, mid); x.clip(); track(1, 'rgba(242,205,110,.9)', 1.6 * dpr); track(2, 'rgba(205,214,235,.85)', 1.4 * dpr); x.restore();
  x.save(); x.beginPath(); x.rect(0, mid, W, H - mid); x.clip(); x.setLineDash([2 * dpr, 3 * dpr]); track(1, 'rgba(242,205,110,.35)', dpr); track(2, 'rgba(205,214,235,.3)', dpr); x.restore();
  const cx = W / 2; x.fillStyle = 'rgba(230,201,138,.9)'; x.fillRect(cx - dpr / 2, 0, dpr, H);
  if (E) {
    x.fillStyle = '#f5d27a'; x.beginPath(); x.arc(cx, Y(E.sunAlt), 4.5 * dpr, 0, 7); x.fill();
    x.save(); x.translate(cx, Y(E.moonAlt)); drawMoonDisc(x, 0, 0, 5 * dpr, E.moonPhaseAngle < 180 ? 0 : Math.PI, E.moonPA); x.restore();
  }
  x.textAlign = 'left'; x.textBaseline = 'bottom'; x.font = `500 ${10 * dpr}px "IBM Plex Sans Condensed", sans-serif`;
  x.fillStyle = 'rgba(242,205,110,.8)'; x.fillText('Sun', 4 * dpr, H - 3 * dpr);
  x.fillStyle = 'rgba(205,214,235,.8)'; x.fillText('Moon', 30 * dpr, H - 3 * dpr);
  tlDirty = false;
}
(function tlDrag() {
  const strip = $('tlStrip'); let st = null;
  strip.addEventListener('pointerdown', (e) => { strip.setPointerCapture(e.pointerId); st = {x: e.clientX, t: S.t.getTime(), w: strip.getBoundingClientRect().width}; });
  strip.addEventListener('pointermove', (e) => { if (!st) return; setTime(st.t - (e.clientX - st.x) / st.w * 24 * HOUR); interact(); });
  const end = () => { st = null; }; strip.addEventListener('pointerup', end); strip.addEventListener('pointercancel', end);
  strip.addEventListener('wheel', (e) => { e.preventDefault(); setTime(S.t.getTime() + Math.sign(e.deltaY || e.deltaX) * 15 * 60000); }, {passive: false});
})();

// ================================================================== export 4096 px
$('bExport').onclick = async () => {
  const b = $('bExport'); b.disabled = true; toast('Rendering a 4096 px frame…');
  await new Promise((r) => setTimeout(r, 30));
  try {
    const W = 4096, H = Math.round(4096 * cssH / cssW), Sx = W / cssW;
    const out = document.createElement('canvas'); out.width = W; out.height = H; const o = out.getContext('2d');
    o.fillStyle = '#03050a'; o.fillRect(0, 0, W, H);
    const vp = viewParams(W, H);
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tx = tmp.getContext('2d');
    if (GS) { cSky.width = W; cSky.height = H; glDraw(GS, vp, 0, Sx); o.drawImage(cSky, 0, 0); } else { fallbackSky(vp, tx); o.drawImage(tmp, 0, 0); }
    const savedLow = LOWSTARS, savedHits = HITS, savedSel = S.selScreen;
    renderMain(tx, vp, Sx, {hits: false, collectLow: true}); staticLowStars(tx);
    LOWSTARS = savedLow; HITS = savedHits; S.selScreen = savedSel;
    o.drawImage(tmp, 0, 0);
    if (GG && S.L.ground) { cGround.width = W; cGround.height = H; glDraw(GG, vp, 1, Sx); o.drawImage(cGround, 0, 0); } else if (!GG) { fallbackGround(vp, tx); o.drawImage(tmp, 0, 0); }
    renderHud(tx, vp, Sx); o.drawImage(tmp, 0, 0);
    o.font = `italic ${15 * Sx}px "IM Fell English", Georgia, serif`; o.fillStyle = 'rgba(230,201,138,.75)'; o.textAlign = 'left'; o.textBaseline = 'bottom';
    o.fillText(`${S.site.name} · ${fmt(S.site.tz, {dateStyle: 'medium', timeStyle: 'short'}).format(S.t)} ${tzAbbr()} · Darksite`, 18 * Sx, H - 16 * Sx);
    resize(); renderFrame();
    const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
    if (!blob) throw new Error('the browser could not encode the image');
    const p = tzParts(S.site.tz, S.t), z = (n) => String(n).padStart(2, '0');
    const filename = `darksite-${p.y}${z(p.mo)}${z(p.d)}-${z(p.h)}${z(p.mi)}-${S.mode}.png`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Saved ' + filename);
  } catch (e) { console.error(e); toast('Export failed: ' + (e.message || e)); resize(); }
  b.disabled = false; requestRender();
};
function showShot(blob, filename) {
  $('shotImg').src = URL.createObjectURL(blob);
  $('shotCap').textContent = `${filename} · 4096 px wide. Right-click or long-press the image to save it.`;
  $('shot').hidden = false;
}
$('shotClose').onclick = () => { $('shot').hidden = true; URL.revokeObjectURL($('shotImg').src); };

// ================================================================== main loop
let lastFrame = performance.now(), lastTw = 0, lastTick = 0, lastTl = 0;
function loop(now) {
  const dt = Math.min(now - lastFrame, 250); lastFrame = now;
  try {
    stepFly(now);
    if (S.playing) {
      S.t = new Date(S.t.getTime() + dt * S.speed);
      if (Math.abs(S.speed) > 1) { requestRender(); tlDirty = true; }
      else if (now - lastTick > 1000) { lastTick = now; requestRender(); tlDirty = true; }
    }
    if (dirty) { dirty = false; renderFrame(); updatePanel(false); }
    if (E && S.t.getTime() !== lastPanelSim && now - lastPanel >= 500 && E.date === S.t) updatePanel(true);
    if (tlDirty && now - lastTl > 60) { lastTl = now; drawTimeline(); }
    if (S.L.tw && !REDUCED && now - lastTw > 33) { lastTw = now; renderTwinkle(xTw, now, cTw.width, cTw.height); }
  } catch (e) { warnOnce('loop', e); }
  requestAnimationFrame(loop);
}
function init() {
  initGL(); syncSiteSel(); syncBortle(); setMode(S.mode);
  resize(); loadMW();
  window.addEventListener('resize', resize);
  new ResizeObserver(() => { tlDirty = true; }).observe($('tlStrip'));
  renderFrame(); updatePanel(true); drawTimeline();
  let veiled = true;
  const done = () => { if (!veiled) return; veiled = false; $('loading').classList.add('gone'); setTimeout(() => { const l = $('loading'); if (l) l.remove(); }, 900); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { requestRender(); tlDirty = true; lastPanelSim = 0; done(); });
  setTimeout(done, 2500);
  requestAnimationFrame(loop);
}
if (!A || !SD) { $('loading').textContent = 'The ephemeris library could not load. Check your connection and reload the page.'; return; }
try { init(); } catch (e) { console.error(e); $('loading').textContent = 'Darksite could not start in this browser: ' + (e.message || e); }
})();
