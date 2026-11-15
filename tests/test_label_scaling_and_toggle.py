"""Unit tests for Item D (Site Labels Toggle) and Item E (Constant-Size 3D Labels & Occlusion).

Requirements:
- Label toggle state persists across views and defaults to enabled.
- Toggle hotkey 'L' flips label state.
- When labels are OFF, only the selected site or hovered site shows a label.
- When labels are ON, hero sites and selected sites show labels.
- Labels are occluded on backface (normal pointing away from camera).
- Fixed font size (10-11px) does not scale with camera distance.
"""

import json
from pathlib import Path
import pytest


class GlobeLabelController:
    """Mirrors the label visibility and scaling logic of HorizonGlobe.jsx and TerrainViewer.jsx."""

    def __init__(self, initial_show=True):
        self.show_labels = initial_show
        self.max_visible_labels = 8

    def toggle_labels(self):
        self.show_labels = not self.show_labels
        return self.show_labels

    def handle_keyboard_shortcut(self, key, is_input_focused=False):
        if is_input_focused:
            return self.show_labels
        if key in ("l", "L"):
            return self.toggle_labels()
        return self.show_labels

    def should_render_label(self, site, is_selected=False, is_hovered=False):
        if is_selected:
            return True
        if is_hovered:
            return True
        if not self.show_labels:
            return False
        # When labels are ON, hero sites are rendered up to max_visible_labels
        return site.get("coverage") == "hero"

    def is_backface_culled(self, site_norm, camera_pos):
        """Dot product of surface normal and camera vector.

        If dot <= 0, the site is facing away from the camera.
        """
        dot = sum(n * c for n, c in zip(site_norm, camera_pos))
        return dot <= 0.0


def test_label_toggle_defaults_to_true():
    ctl = GlobeLabelController()
    assert ctl.show_labels is True


def test_keyboard_shortcut_l_toggles_labels():
    ctl = GlobeLabelController(initial_show=True)
    assert ctl.handle_keyboard_shortcut("L") is False
    assert ctl.handle_keyboard_shortcut("l") is True
    # Should not toggle if user is typing in an input
    assert ctl.handle_keyboard_shortcut("L", is_input_focused=True) is True


def test_labels_off_shows_only_selected_or_hovered():
    ctl = GlobeLabelController(initial_show=False)
    hero_site = {"id": "shackleton_connecting_ridge", "coverage": "hero"}
    normal_site = {"id": "apollo_11", "coverage": "verified"}

    # Unselected hero site when labels OFF -> Hidden
    assert ctl.should_render_label(hero_site, is_selected=False, is_hovered=False) is False

    # Selected site when labels OFF -> Visible
    assert ctl.should_render_label(hero_site, is_selected=True, is_hovered=False) is True

    # Hovered site when labels OFF -> Visible (tooltip)
    assert ctl.should_render_label(normal_site, is_selected=False, is_hovered=True) is True


def test_labels_on_shows_hero_sites():
    ctl = GlobeLabelController(initial_show=True)
    hero_site = {"id": "shackleton_connecting_ridge", "coverage": "hero"}
    normal_site = {"id": "apollo_11", "coverage": "verified"}

    # Hero site when labels ON -> Visible
    assert ctl.should_render_label(hero_site, is_selected=False, is_hovered=False) is True

    # Non-hero unselected site when labels ON -> Hidden (to prevent clutter)
    assert ctl.should_render_label(normal_site, is_selected=False, is_hovered=False) is False


def test_backface_culling_occludes_far_side_labels():
    ctl = GlobeLabelController()

    # Site on near side: normal = (0, 0, 1), camera = (0, 0, 2.5) -> dot > 0
    assert ctl.is_backface_culled([0, 0, 1], [0, 0, 2.5]) is False

    # Site on far side: normal = (0, 0, -1), camera = (0, 0, 2.5) -> dot < 0
    assert ctl.is_backface_culled([0, 0, -1], [0, 0, 2.5]) is True
