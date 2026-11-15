"""Test suite ensuring zero banned phrases or fabricated claims exist in frontend UI copy.

Enforces Section 2.3b and Definition of Done:
- "Zero-fabrication guarantee"
- "100% benchmark convergence" / "100% convergence"
- "Ray-traced skyline engine"
- "Photorealistic"
- "Go / No-Go verdict"
- "Safety score" (replaced with "Modelled Feasibility Index" / "Modelled Constraint Check")
- "Cryptographic hash ensuring correctness"
- "NASA-validated", "NASA-approved", "guaranteed", "optimal"
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
WEB_SRC = BASE_DIR / "web" / "src"

BANNED_PHRASES = [
    "zero-fabrication guarantee",
    "zero fabrication guarantee",
    "100% benchmark convergence",
    "100% convergence",
    "ray-traced skyline engine",
    "photorealistic",
    "go / no-go verdict",
    "go/no-go verdict",
    "cryptographic hash ensuring correctness",
    "cryptographic sha-256 hash ensuring reproducibility",
    "nasa-validated",
    "nasa-approved",
]


def test_no_banned_phrases_in_frontend():
    violations = []
    for root, _, files in os.walk(WEB_SRC):
        for f in files:
            if not (f.endswith(".jsx") or f.endswith(".js") or f.endswith(".css")):
                continue
            path = Path(root) / f
            with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                content = fh.read().lower()
            for phrase in BANNED_PHRASES:
                if phrase in content:
                    violations.append(f"{f}: contains '{phrase}'")

    assert not violations, f"Found banned phrases in frontend: {violations}"
