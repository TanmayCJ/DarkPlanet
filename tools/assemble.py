#!/usr/bin/env python3
"""Inline build/skydata.js and src/app.js into src/template.html → dist/darksite.html (one self-contained file)."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda *p: open(os.path.join(ROOT, *p), encoding='utf-8').read()
html = rd('src', 'template.html')
html = html.replace('/*SKYDATA*/', rd('build', 'skydata.js').replace('</script', '<\\/script'))
html = html.replace('/*APP*/', rd('src', 'app.js').replace('</script', '<\\/script'))
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
open(os.path.join(ROOT, 'dist', 'darksite.html'), 'w', encoding='utf-8').write(html)
# a standalone page with its own <head>, for opening directly from disk or hosting anywhere
page = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + '</body></html>')
open(os.path.join(ROOT, 'dist', 'index.html'), 'w', encoding='utf-8').write(page)
print('dist/darksite.html', len(html) // 1024, 'KB')
