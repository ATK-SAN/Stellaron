"""Unit tests for Item C: Home Page CTA and Step Images.

Validates:
- Exactly one "Launch Navigator" button on IntroPage.jsx (in the Hero).
- Navigation header contains no Launch Navigator button.
- Footer contains no Launch Navigator button.
- All three step images exist in web/public/intro/ as both .webp and .jpg.
- Image alt texts contain no banned marketing or certainty phrases.
"""

from pathlib import Path
import re
import pytest

BASE_DIR = Path(__file__).resolve().parent.parent
INTRO_PAGE = BASE_DIR / "web" / "src" / "pages" / "IntroPage.jsx"
INTRO_PUBLIC = BASE_DIR / "web" / "public" / "intro"


def test_exactly_one_launch_navigator_button():
    content = INTRO_PAGE.read_text(encoding="utf-8")
    matches = re.findall(r"Launch Navigator", content)
    assert len(matches) == 1, f"Expected exactly 1 'Launch Navigator' button, found {len(matches)}"


def test_navbar_and_footer_have_no_launch_button():
    content = INTRO_PAGE.read_text(encoding="utf-8")

    # Check header
    header_match = re.search(r"<header.*?</header>", content, re.DOTALL)
    assert header_match is not None, "Header element not found"
    assert "Launch Navigator" not in header_match.group(0), "Nav bar must not contain Launch Navigator"

    # Check footer
    footer_match = re.search(r"<footer.*?</footer>", content, re.DOTALL)
    assert footer_match is not None, "Footer element not found"
    assert "Launch Navigator" not in footer_match.group(0), "Footer must not contain Launch Navigator"


def test_step_images_exist_as_webp_and_jpg():
    steps = ["step-1-explorer", "step-2-rehearsal", "step-3-crosscheck"]
    for step in steps:
        webp_path = INTRO_PUBLIC / f"{step}.webp"
        jpg_path = INTRO_PUBLIC / f"{step}.jpg"
        assert webp_path.exists(), f"Missing WebP image: {webp_path}"
        assert jpg_path.exists(), f"Missing JPEG fallback: {jpg_path}"
        assert webp_path.stat().st_size > 5000, f"WebP image {webp_path.name} is unusually small"
        assert jpg_path.stat().st_size > 5000, f"JPEG image {jpg_path.name} is unusually small"


def test_intro_alt_text_has_no_banned_phrases():
    content = INTRO_PAGE.read_text(encoding="utf-8").lower()
    banned = [
        "zero-fabrication guarantee",
        "100% convergence",
        "guaranteed",
        "nasa-approved",
        "nasa-validated",
        "will survive",
    ]
    for phrase in banned:
        assert phrase not in content, f"Banned phrase '{phrase}' found in IntroPage.jsx"
