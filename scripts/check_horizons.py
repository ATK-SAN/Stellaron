import json
from pathlib import Path

for p in sorted(Path('data/processed').glob('*_2026.json')):
    d = json.loads(p.read_text(encoding='utf-8'))
    h = d.get('horizon')
    sid = d['site']['id']
    if h and 'elevation_deg' in h:
        print(f"{sid:30s} has horizon with {len(h['elevation_deg'])} points")
