#!/usr/bin/env python3
"""Build build/skydata.js from the catalogues in ./vendor (see tools/fetch_data.sh).

Output is one JS file assigning window.SKYDATA = {...}:
  stars    bright stars (mag <= BRIGHT_LIM) with names/metadata, as JSON rows
  faint    BRIGHT_LIM < mag <= FAINT_LIM, packed little-endian binary (base64)
  cons     88 constellations: Latin/English/genitive names, label position, figure lines
  borders  IAU boundary polylines
  asterisms named asterisms with lines
  art      Stellarium figure illustrations (grey JPEG) + 3 anchor stars each
  messier  110 Messier objects
  dsos     other bright NGC/IC/Caldwell objects (mag <= DSO_LIM), named dark nebulae
  mw       Milky Way brightness map, equirectangular RA/Dec, grey PNG
"""
import base64, csv, gzip, io, json, math, os, struct, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = os.path.join(ROOT, 'vendor')
D3 = os.path.join(V, 'd3c', 'package', 'data')
OUT = os.path.join(ROOT, 'build')
BRIGHT_LIM, FAINT_LIM, DSO_LIM = 6.5, 8.0, 10.5
os.makedirs(OUT, exist_ok=True)

GREEK = dict(Alp='α', Bet='β', Gam='γ', Del='δ', Eps='ε', Zet='ζ', Eta='η', The='θ', Iot='ι', Kap='κ', Lam='λ', Mu='μ',
             Nu='ν', Xi='ξ', Omi='ο', Pi='π', Rho='ρ', Sig='σ', Tau='τ', Ups='υ', Phi='φ', Chi='χ', Psi='ψ', Ome='ω')
SUP = {'1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'}
LUM = ['', 'Ia', 'Ib', 'I', 'II', 'III', 'IV', 'V']


def lum_class(sp):
    s = sp[1:]
    for k, c in ((6, 'IV'), (5, 'III'), (4, 'II'), (1, 'Ia'), (2, 'Ib'), (3, 'I'), (7, 'V')):
        if c in s:
            return k
    return 0


def b64(b):
    return base64.b64encode(b).decode()


# ------------------------------------------------------------------ stars
hip_pos, bright, faint = {}, [], []
with gzip.open(os.path.join(V, 'hyg.csv.gz'), 'rt') as f:
    for r in csv.DictReader(f):
        if r['proper'] == 'Sol':
            continue
        ra, dec, mag = float(r['ra']) * 15, float(r['dec']), float(r['mag'])
        if r['hip']:
            hip_pos[int(r['hip'])] = (ra, dec)
        if mag > FAINT_LIM:
            continue
        ci = float(r['ci']) if r['ci'] not in ('', None) else 0.6
        dist = float(r['dist'] or 0)
        ly = round(dist * 3.26156) if 0 < dist < 100000 else 0
        hip = int(r['hip']) if r['hip'] else 0
        sp = r['spect'] or ''
        if mag <= BRIGHT_LIM:
            b = r['bayer']
            bs = ''
            if b:
                g = b.rstrip('0123456789-')
                n = b[len(g):].lstrip('-')
                bs = GREEK.get(g, g) + ''.join(SUP.get(ch, ch) for ch in n)
            desig = bs or r['flam'] or ''
            var = r['var'] if r['var'] and r['var'] != desig else ''
            vr = [float(r['var_min']), float(r['var_max'])] if r['var_min'] and r['var_max'] else None
            row = [round(ra, 4), round(dec, 4), round(mag, 2), round(ci, 2), hip, r['proper'], desig, r['con'], sp[:14], ly]
            if var or (vr and vr[1] - vr[0] >= 0.3):
                row.append([var, vr[0] if vr else None, vr[1] if vr else None])
            bright.append(row)
        else:
            faint.append((ra, dec, mag, ci, hip, min(ly, 65535), 'OBAFGKMCSWDN'.find(sp[:1]) + 1 if sp else 0, lum_class(sp), r['con']))
bright.sort(key=lambda s: s[2])
faint.sort(key=lambda s: s[2])
CONS_IDX = sorted({s[8] for s in faint})
fb = bytearray()
for ra, dec, mag, ci, hip, ly, sc, lc, con in faint:
    fb += struct.pack('<ffhhiHBBB', ra, dec, int(round(mag * 100)), int(round(ci * 1000)), hip, ly, sc, lc, CONS_IDX.index(con) if con in CONS_IDX else 255)
print('stars', len(bright), 'faint', len(faint), len(fb) // 1024, 'KB')

# ------------------------------------------------------------------ constellations
cons = json.load(open(os.path.join(D3, 'constellations.json')))['features']
lines = {f['id']: f['geometry']['coordinates'] for f in json.load(open(os.path.join(D3, 'constellations.lines.json')))['features']}
C = []
for f in cons:
    p = f['properties']
    disp = p.get('display') or [f['geometry']['coordinates'][0], f['geometry']['coordinates'][1], 30]
    C.append(dict(id=f['id'], la=p['la'], en=p['en'], gen=p['gen'], rank=int(p['rank']), pos=[round(disp[0] % 360, 2), disp[1]],
                  lines=[[[round(x % 360, 3), round(y, 3)] for x, y in seg] for seg in lines.get(f['id'], [])]))
borders = []
for f in json.load(open(os.path.join(D3, 'constellations.borders.json')))['features']:
    for seg in f['geometry']['coordinates']:
        borders.append([[round(x % 360, 2), round(y, 2)] for x, y in seg])
ast = []
for f in json.load(open(os.path.join(D3, 'asterisms.json')))['features']:
    p = f['properties']
    if p['p'] > 4 or '-' in p['n']:
        continue
    ast.append(dict(n=p['n'].replace("'", '’').strip('’'), p=p['p'], loc=[round(p['loc'][0] % 360, 2), p['loc'][1]],
                    lines=[[[round(x % 360, 3), round(y, 3)] for x, y in seg] for seg in f['geometry']['coordinates']]))
print('constellations', len(C), 'border segments', len(borders), 'asterisms', len(ast))

# ------------------------------------------------------------------ figure art
sc = json.load(open(os.path.join(V, 'modern.json')))
art = []
for c in sc['constellations']:
    im = c.get('image')
    if not im:
        continue
    anchors = [[a['pos'][0], a['pos'][1], round(hip_pos[a['hip']][0], 4), round(hip_pos[a['hip']][1], 4)] for a in im['anchors'] if a['hip'] in hip_pos]
    img = Image.open(os.path.join(V, 'art', os.path.basename(im['file']))).convert('L')
    w, h = img.size
    s = 448 / max(w, h)
    if s < 1:
        img = img.resize((round(w * s), round(h * s)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=74)
    art.append(dict(id=c['id'].split()[-1], w=w, h=h, a=anchors, img='data:image/jpeg;base64,' + b64(buf.getvalue())))
print('art', len(art), sum(len(a['img']) for a in art) // 1024, 'KB')


# ------------------------------------------------------------------ deep sky
def dims(s):
    s = (s or '').replace('×', 'x')
    try:
        ab = [float(x) for x in s.split('x') if x]
    except ValueError:
        ab = []
    if not ab:
        return [1.0, 1.0]
    return [ab[0], ab[1] if len(ab) > 1 else ab[0]]


M = []
for f in json.load(open(os.path.join(D3, 'messier.json')))['features']:
    p = f['properties']
    ra, dec = f['geometry']['coordinates']
    a, b = dims(p['dim'])
    M.append([p['name'], p['desig'], p['alt'], p['type'], float(p['mag'] or 9), a, b, round(ra % 360, 4), round(dec, 4)])
names = json.load(open(os.path.join(D3, 'dsonames.json')))
# NGC/IC designations already covered by a Messier entry (e.g. NGC 224 = M31); skip them to avoid duplicates
messier_desigs = {m[1].replace(' ', '') for m in M if m[1]}
messier_pos = [(m[7], m[8]) for m in M]
TYPEMAP = {'g': 's', 's0': 's', 'sd': 's', 'bn': 'en', 'en': 'en', 'sfr': 'sfr'}
DS = []
seen = set()
for f in json.load(open(os.path.join(D3, 'dsos.14.json')))['features']:
    p = f['properties']
    did = f['id']
    if did.startswith('M ') or did in seen or did.replace(' ', '') in messier_desigs:
        continue
    t = p['type']
    nm = names.get(did, {}).get('name', '')
    try:
        mag = float(p['mag'])
    except (TypeError, ValueError):
        mag = 99.0
    if t == 'dn':
        if not nm:
            continue
    elif mag > DSO_LIM:
        continue
    seen.add(did)
    a, b = dims(p['dim'])
    ra, dec = f['geometry']['coordinates']
    if t != 'dn' and any(abs(((ra - mr + 180) % 360) - 180) * math.cos(math.radians(dec)) < 0.05 and abs(dec - md) < 0.05 for mr, md in messier_pos):
        continue  # same object as a Messier entry under another designation
    if t == 'dn':
        mag = 99.0  # the catalogue's "magnitude" for dark nebulae is an opacity class, not a brightness
    DS.append([did, nm, TYPEMAP.get(t, t), round(mag, 1) if mag < 90 else None, a, b, round(ra % 360, 4), round(dec, 4)])
print('messier', len(M), 'dsos', len(DS))

# ------------------------------------------------------------------ Milky Way texture
W, H = 2048, 1024
NGP_RA, NGP_DEC, L_NCP = math.radians(192.85948), math.radians(27.12825), math.radians(122.93192)


def eq2gal(ra, dec):
    ra = np.radians(ra)
    dec = np.radians(dec)
    sb = np.sin(dec) * math.sin(NGP_DEC) + np.cos(dec) * math.cos(NGP_DEC) * np.cos(ra - NGP_RA)
    b = np.arcsin(np.clip(sb, -1, 1))
    y = np.cos(dec) * np.sin(ra - NGP_RA)
    x = np.sin(dec) * math.cos(NGP_DEC) - np.cos(dec) * math.sin(NGP_DEC) * np.cos(ra - NGP_RA)
    return np.degrees((L_NCP - np.arctan2(y, x)) % (2 * math.pi)), np.degrees(b)


# rasterise in galactic coordinates where the band is a strip; rings that wrap all the way round are closed via the pole (even-odd)
GW, GH = 4096, 2048
acc_g = np.zeros((GH, GW), np.float32)
for lvl, f in enumerate(json.load(open(os.path.join(D3, 'mw.json')))['features']):
    mask = np.zeros((GH, GW), bool)
    for poly in f['geometry']['coordinates']:
        for ring in poly:
            arr = np.array(ring, float)
            l, b = eq2gal(arr[:, 0], arr[:, 1])
            pts, prev = [], None
            for x, y in zip(l, b):
                if prev is not None:
                    while x - prev > 180: x -= 360
                    while x - prev < -180: x += 360
                pts.append((x, y))
                prev = x
            if abs(pts[-1][0] - pts[0][0]) > 180:
                pts += [(pts[-1][0], 90.0), (pts[0][0], 90.0)]
            layer = Image.new('1', (GW, GH), 0)
            dr = ImageDraw.Draw(layer)
            for off in (-720, -360, 0, 360, 720):
                dr.polygon([((x + off) / 360 * GW, (90 - y) / 180 * GH) for x, y in pts], fill=1)
            mask ^= np.asarray(layer, bool)
    acc_g += mask * [0.20, 0.22, 0.22, 0.20, 0.18][lvl]
ys, xs = np.mgrid[0:H, 0:W]
ra_e, de_e = (xs + .5) / W * 360, 90 - (ys + .5) / H * 180
lg, bg = eq2gal(ra_e, de_e)
acc = acc_g[np.clip(((90 - bg) / 180 * GH).astype(int), 0, GH - 1), (lg / 360 * GW).astype(int) % GW]
a = np.asarray(Image.fromarray(np.clip(acc * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)), np.float32) / 255
ra, de = np.radians(ra_e), np.radians(de_e)
r0, d0 = math.radians(266.4), math.radians(-28.94)
sep = np.degrees(np.arccos(np.clip(np.sin(de) * math.sin(d0) + np.cos(de) * math.cos(d0) * np.cos(ra - r0), -1, 1)))
boost = 1 + 1.1 * np.exp(-(sep / 38) ** 2) + 0.35 * np.exp(-(sep / 90) ** 2)
rng = np.random.default_rng(7)
n = np.zeros((H, W), np.float32)
for s_, amp in ((64, .5), (24, .3), (8, .2)):
    small = rng.random((H // s_ + 2, W // s_ + 2)).astype(np.float32)
    n += np.asarray(Image.fromarray((small * 255).astype(np.uint8)).resize((W + 2 * s_, H + 2 * s_), Image.BICUBIC), np.float32)[:H, :W] / 255 * amp
a = a * boost * (0.75 + 0.5 * n)
a = a / np.percentile(a, 99.9)
img = Image.fromarray(np.clip(a ** 0.9 * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
buf = io.BytesIO()
img.save(buf, 'PNG', optimize=True)
print('milky way', len(buf.getvalue()) // 1024, 'KB')

data = dict(stars=bright, faint=dict(n=len(faint), cons=CONS_IDX, b64=b64(bytes(fb))), cons=C, borders=borders, asterisms=ast,
            art=art, messier=M, dsos=DS, mw='data:image/png;base64,' + b64(buf.getvalue()))
s = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(OUT, 'skydata.js'), 'w').write('window.SKYDATA=' + s.replace('</', '<\\/') + ';\n')
print('skydata.js', len(s) // 1024, 'KB')
