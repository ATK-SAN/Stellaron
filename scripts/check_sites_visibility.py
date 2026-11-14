import json
import glob
import os

files = glob.glob(r'C:\Users\athul\.gemini\antigravity\scratch\stellaron\web\public\data\*_2026.json')
print(f"Found {len(files)} site files")
for path in sorted(files):
    with open(path, 'r') as f:
        d = json.load(f)
    site_id = d['site']['id']
    m_earth = d['metrics']['geometric_earth_visibility']
    m_sun = d['metrics']['sunlight']
    sun_pct = m_sun['sunlight_fraction'] * 100
    sun_night = m_sun['longest_dark_run_s'] / 3600
    earth_pct = m_earth['visibility_fraction'] * 100
    earth_blk = m_earth['longest_earth_blackout_s'] / 3600
    print(f"{site_id:30s} | Sun: {sun_pct:5.1f}% (max night: {sun_night:5.1f}h) | Earth: {earth_pct:5.1f}% (max blackout: {earth_blk:5.1f}h)")
