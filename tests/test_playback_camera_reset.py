"""Unit tests for Section 6b.B: Playback Camera Reset & State Transitions."""

import pytest


class PlaybackStateController:
    """Mock state controller mirroring ChoreographyPlayer.jsx logic."""
    def __init__(self, initial_step=0, initial_mode="flight"):
        self.step = initial_step
        self.view_mode = initial_mode
        self.has_switched_to_ridge = False
        self.camera_reset_count = 0
        self.camera_pos = [3.2, 3.8, 4.5]
        self.camera_fov = 46
        self.is_playing = False

    def reset_playback_view(self):
        self.view_mode = "flight"
        self.has_switched_to_ridge = False
        self.camera_reset_count += 1
        self.camera_pos = [3.2, 3.8, 4.5]
        self.camera_fov = 46

    def advance_step(self, next_step):
        self.step = next_step
        if not self.has_switched_to_ridge and next_step >= 92:
            self.has_switched_to_ridge = True
            self.view_mode = "ridge"

    def handle_play_toggle(self, total_steps=108):
        if self.is_playing:
            self.is_playing = False
        else:
            if self.step >= total_steps - 1:
                self.step = 0
                self.reset_playback_view()
            self.is_playing = True

    def handle_scrubber(self, val):
        self.step = val
        if val < 92 and self.has_switched_to_ridge:
            self.reset_playback_view()

    def handle_site_change(self):
        self.step = 0
        self.is_playing = False
        self.reset_playback_view()

    def handle_slip_change(self):
        self.step = 0
        self.is_playing = False
        self.reset_playback_view()


def test_initial_mode_is_flight():
    ctl = PlaybackStateController()
    assert ctl.view_mode == "flight"
    assert ctl.camera_pos == [3.2, 3.8, 4.5]
    assert ctl.has_switched_to_ridge is False


def test_automatic_ridge_switch_at_landing():
    ctl = PlaybackStateController()
    ctl.advance_step(50)
    assert ctl.view_mode == "flight"

    ctl.advance_step(92)
    assert ctl.view_mode == "ridge"
    assert ctl.has_switched_to_ridge is True


def test_replay_from_end_resets_camera_and_flight_mode():
    ctl = PlaybackStateController(initial_step=107, initial_mode="ridge")
    ctl.has_switched_to_ridge = True

    ctl.handle_play_toggle(total_steps=108)
    assert ctl.step == 0
    assert ctl.view_mode == "flight"
    assert ctl.has_switched_to_ridge is False
    assert ctl.camera_reset_count == 1


def test_scrub_back_resets_flight_mode():
    ctl = PlaybackStateController()
    ctl.advance_step(95)
    assert ctl.view_mode == "ridge"

    # Scrub back to T+0 launch phase
    ctl.handle_scrubber(10)
    assert ctl.step == 10
    assert ctl.view_mode == "flight"
    assert ctl.has_switched_to_ridge is False
    assert ctl.camera_reset_count == 1


def test_site_change_resets_view_and_camera():
    ctl = PlaybackStateController(initial_step=100, initial_mode="ridge")
    ctl.handle_site_change()
    assert ctl.step == 0
    assert ctl.view_mode == "flight"
    assert ctl.has_switched_to_ridge is False


def test_second_playback_cycle_switches_to_ridge_again():
    ctl = PlaybackStateController()
    # First cycle
    ctl.advance_step(95)
    assert ctl.view_mode == "ridge"

    # Replay
    ctl.step = 107
    ctl.handle_play_toggle(total_steps=108)
    assert ctl.view_mode == "flight"

    # Advance again to landing in second run
    ctl.advance_step(92)
    assert ctl.view_mode == "ridge"
