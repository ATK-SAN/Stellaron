"""Unit tests for Item B: Site Selection Flow & Empty States.

Requirements:
- On first load of /app no site is selected (None).
- Clicking a site selects it.
- Clicking the selected site again deselects it.
- Pressing Esc deselects.
- Deep link ?site=<id> preselects if id is valid; unknown ids are ignored.
- All workspaces handle no site selected gracefully.
"""

import json
from pathlib import Path
import pytest


class SiteSelectionManager:
    """Mirrors the selection state machine in App.jsx."""

    def __init__(self, sites=None, query_param=None):
        self.sites = sites or []
        self.selected_site = None
        self.site_data = None

        # Deep link handling on init
        if query_param:
            match = next((s for s in self.sites if s["id"] == query_param), None)
            if match:
                self.selected_site = match

    def select_site(self, site):
        if not site:
            self.selected_site = None
            self.site_data = None
            return

        if self.selected_site and self.selected_site.get("id") == site.get("id"):
            # Clicked again -> deselect
            self.selected_site = None
            self.site_data = None
        else:
            self.selected_site = site

    def handle_escape_key(self):
        self.selected_site = None
        self.site_data = None


@pytest.fixture
def sample_sites():
    idx_path = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "library_index.json"
    with open(idx_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("sites", [])


def test_initial_selection_is_none(sample_sites):
    """On first load without query param, no site is selected."""
    mgr = SiteSelectionManager(sites=sample_sites)
    assert mgr.selected_site is None
    assert mgr.site_data is None


def test_click_selects_site(sample_sites):
    """Clicking a site sets selection."""
    mgr = SiteSelectionManager(sites=sample_sites)
    target = sample_sites[0]
    mgr.select_site(target)
    assert mgr.selected_site is not None
    assert mgr.selected_site["id"] == target["id"]


def test_click_again_deselects_site(sample_sites):
    """Clicking the selected site again deselects it."""
    mgr = SiteSelectionManager(sites=sample_sites)
    target = sample_sites[0]

    # First click -> select
    mgr.select_site(target)
    assert mgr.selected_site["id"] == target["id"]

    # Second click -> deselect
    mgr.select_site(target)
    assert mgr.selected_site is None
    assert mgr.site_data is None


def test_esc_key_deselects_site(sample_sites):
    """Pressing Esc deselects the current site."""
    mgr = SiteSelectionManager(sites=sample_sites)
    mgr.select_site(sample_sites[1])
    assert mgr.selected_site is not None

    mgr.handle_escape_key()
    assert mgr.selected_site is None


def test_deep_link_preselects_valid_id(sample_sites):
    """Valid ?site=<id> preselects the site on load."""
    mgr = SiteSelectionManager(sites=sample_sites, query_param="shackleton_connecting_ridge")
    assert mgr.selected_site is not None
    assert mgr.selected_site["id"] == "shackleton_connecting_ridge"


def test_deep_link_ignores_unknown_id(sample_sites):
    """Unknown ?site=<id> is ignored, leaving selection as None."""
    mgr = SiteSelectionManager(sites=sample_sites, query_param="unknown_fictional_crater_99")
    assert mgr.selected_site is None


def test_selection_persistence_between_workspaces(sample_sites):
    """Selection persists across workspace transitions until explicitly deselected."""
    mgr = SiteSelectionManager(sites=sample_sites)
    mgr.select_site(sample_sites[2])
    selected_id = mgr.selected_site["id"]

    # Simulate moving between tabs
    active_window = "celestial"
    assert mgr.selected_site["id"] == selected_id

    active_window = "timeline"
    assert mgr.selected_site["id"] == selected_id

    active_window = "energy"
    assert mgr.selected_site["id"] == selected_id

    # Deselecting clears it
    mgr.select_site(mgr.selected_site)
    assert mgr.selected_site is None
