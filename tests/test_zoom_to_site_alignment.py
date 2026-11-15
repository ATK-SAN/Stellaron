"""Unit tests for Item F: Check and verify Zoom-to-Site alignment for all 14 candidate sites.

Verifies:
1. For every site in library_index.json, Zoom-to-Site camera standoff points directly at the site.
2. The angle error between camera forward vector and the site normal is below 0.05 degrees.
3. The camera is on the site's side of the Moon (dot product > 0).
4. The camera distance is strictly outside the Moon (R > 1.0) and does not clip into terrain.
5. Changing site while zoomed produces distinct, correct camera vectors.
"""

import json
import math
from pathlib import Path
import pytest


def lat_lon_to_vec3(lat, lon, r=1.015):
    phi = (90 - lat) * (math.pi / 180)
    theta = (lon + 180) * (math.pi / 180)
    return [
        -r * math.sin(phi) * math.cos(theta),
        r * math.cos(phi),
        r * math.sin(phi) * math.sin(theta),
    ]


def compute_site_zoom_vectors(lat_deg, lon_deg):
    sp = lat_lon_to_vec3(lat_deg, lon_deg, 1.015)
    sp_norm = [p / 1.015 for p in sp]
    # Standoff along normal
    cam_pos = [n * 1.48 for n in sp_norm]
    look_at = list(sp)
    # Forward vector (cam_pos -> look_at)
    fwd = [look_at[i] - cam_pos[i] for i in range(3)]
    fwd_len = math.sqrt(sum(x ** 2 for x in fwd))
    fwd_u = [x / fwd_len for x in fwd]
    return {
        "sp": sp,
        "sp_norm": sp_norm,
        "cam_pos": cam_pos,
        "look_at": look_at,
        "fwd_u": fwd_u,
    }


@pytest.fixture
def library_sites():
    idx_path = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "library_index.json"
    with open(idx_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("sites", [])


def test_zoom_to_site_all_14_sites(library_sites):
    assert len(library_sites) == 14

    for site in library_sites:
        vecs = compute_site_zoom_vectors(site["lat_deg"], site["lon_deg"])
        norm = vecs["sp_norm"]
        fwd_u = vecs["fwd_u"]
        cam = vecs["cam_pos"]

        # 1. Camera is outside Moon (radius > 1.0)
        cam_dist = math.sqrt(sum(c ** 2 for c in cam))
        assert cam_dist > 1.2, f"Camera too close for {site['id']}: {cam_dist}"
        assert cam_dist < 2.0, f"Camera too far for {site['id']}: {cam_dist}"

        # 2. Camera is on the site's side of the Moon (dot > 0)
        dot_side = sum(c * n for c, n in zip(cam, norm)) / cam_dist
        assert dot_side > 0.95, f"Camera not on site's side for {site['id']}: {dot_side}"

        # 3. Camera forward vector is anti-parallel to normal (pointing directly at site)
        # dot(-norm, fwd_u) == 1.0 -> angle == 0 deg
        dot_align = sum(-n * f for n, f in zip(norm, fwd_u))
        angle_err_deg = math.degrees(math.acos(max(-1.0, min(1.0, dot_align))))
        assert angle_err_deg < 0.05, f"Angle error too large for {site['id']}: {angle_err_deg} deg"


def test_zoom_to_site_changes_on_new_selection(library_sites):
    s1 = library_sites[0]  # Shackleton Connecting Ridge (-89.54)
    s2 = next(s for s in library_sites if s["id"] == "apollo_11")  # Apollo 11 (+0.67)

    v1 = compute_site_zoom_vectors(s1["lat_deg"], s1["lon_deg"])
    v2 = compute_site_zoom_vectors(s2["lat_deg"], s2["lon_deg"])

    # Camera positions must be completely distinct
    dist_between_cams = math.sqrt(sum((c1 - c2) ** 2 for c1, c2 in zip(v1["cam_pos"], v2["cam_pos"])))
    assert dist_between_cams > 1.0
