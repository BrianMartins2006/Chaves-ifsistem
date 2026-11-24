#!/usr/bin/env python3
"""Update the published timetable PDF and its searchable class-group index."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('pdf', type=Path)
parser.add_argument('--label', required=True, help='Public version label, e.g. 2026/2 · 16/11/2026')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
text = subprocess.check_output(['pdftotext', '-layout', str(args.pdf), '-'], text=True)
pages = [page for page in text.split('\f') if page.strip()]
bbox = ET.fromstring(subprocess.check_output(['pdftotext', '-bbox', str(args.pdf), '-']))
bounds = list(bbox.iter('{http://www.w3.org/1999/xhtml}page'))
groups = []
for number, page in enumerate(pages, 1):
    lines = [line.strip() for line in page.splitlines() if line.strip()]
    header = next((i for i, line in enumerate(lines) if 'Segunda-feira' in line), None)
    if header is None or header < 2:
        raise SystemExit(f'Unable to identify class group on page {number}; inspect PDF layout')
    groups.append({'page': number, 'name': ' '.join(lines[1:header]), 'text': page.strip(), 'heightFraction': min(1, (max(float(word.attrib['yMax']) for word in bounds[number-1].iter('{http://www.w3.org/1999/xhtml}word')) + 12) / float(bounds[number-1].attrib['height']))})
if not groups:
    raise SystemExit('PDF contains no readable class groups')
pdf_target = root / 'frontend/public/horarios/horario-atual.pdf'
index_target = root / 'frontend/src/data/timetable-index.json'
pdf_target.parent.mkdir(parents=True, exist_ok=True)
index_target.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(args.pdf, pdf_target)
index_target.write_text(json.dumps({'label': args.label, 'file': '/horarios/horario-atual.pdf', 'groups': groups}, ensure_ascii=False, indent=2) + '\n')
print(f'Updated PDF and index: {len(groups)} groups')
