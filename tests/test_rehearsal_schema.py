"""Unit tests for rehearsal/schema.py."""

import json
import pytest
from rehearsal.schema import validate_mission_plan, ValidationError, generate_json_schema, MAX_FILE_BYTES


def valid_mission_dict():
    return {
        "schema_version": 1,
        "centre": "ESOC Darmstadt",
        "mission": "Artemis-Rehearsal-Alpha",
        "launch_utc": "2026-04-01T00:00:00Z",
        "transit_days": 4.5,
        "orbit_hold_days": 1.0,
        "landing_site_id": "shackleton_connecting_ridge",
        "surface_days": 14.0,
        "hardware": {
            "panel_m2": 2.5,
            "panel_efficiency": 0.28,
            "battery_wh": 1200.0,
            "base_load_w": 65.0,
            "min_soc_fraction": 0.20,
        },
        "constraints": {
            "max_earth_blackout_h": 48.0,
            "min_sunlit_fraction": 0.35,
        },
        "delay_scenarios": [
            {
                "type": "launch_slip",
                "days": 3.0,
                "probability": 0.35,
            },
            {
                "type": "comms_outage",
                "outage_hours": 12.0,
                "probability": 0.15,
            },
        ],
    }


def test_valid_mission_plan_passes():
    plan = valid_mission_dict()
    res = validate_mission_plan(plan)
    assert res["schema_version"] == 1
    assert res["centre"] == "ESOC Darmstadt"
    assert res["mission"] == "Artemis-Rehearsal-Alpha"
    assert res["transit_days"] == 4.5
    assert res["hardware"]["battery_wh"] == 1200.0
    assert res["_meta"]["assigned_probability"] == pytest.approx(0.50)
    assert res["_meta"]["unspecified_probability"] == pytest.approx(0.50)


def test_missing_required_fields():
    for req in ["schema_version", "centre", "mission", "launch_utc", "transit_days", "landing_site_id", "surface_days"]:
        plan = valid_mission_dict()
        del plan[req]
        with pytest.raises(ValidationError) as exc:
            validate_mission_plan(plan)
        assert req in str(exc.value)


def test_unknown_root_field_rejected():
    plan = valid_mission_dict()
    plan["unsupported_custom_key"] = "hack"
    with pytest.raises(ValidationError) as exc:
        validate_mission_plan(plan)
    assert "Unknown field" in str(exc.value)
    assert "unsupported_custom_key" in str(exc.value)


def test_unknown_hardware_field_rejected():
    plan = valid_mission_dict()
    plan["hardware"]["supercapacitor_f"] = 100.0
    with pytest.raises(ValidationError) as exc:
        validate_mission_plan(plan)
    assert "Unknown field(s) in hardware" in str(exc.value)


def test_transit_days_out_of_range():
    plan = valid_mission_dict()
    plan["transit_days"] = 0.5  # Below 1
    with pytest.raises(ValidationError) as exc:
        validate_mission_plan(plan)
    assert "transit_days" in str(exc.value)

    plan["transit_days"] = 45.0  # Above 40
    with pytest.raises(ValidationError) as exc:
        validate_mission_plan(plan)
    assert "transit_days" in str(exc.value)


def test_surface_days_out_of_range():
    plan = valid_mission_dict()
    plan["surface_days"] = 35.0  # Above 30
    with pytest.raises(ValidationError) as exc:
        validate_mission_plan(plan)
    assert "surface_days" in str(exc.value)


def test_hardware_bounds():
    plan = valid_mission_dict()
    plan["hardware"]["panel_m2"] = -1.0
    with pytest.raises(ValidationError) as exc:
        validate_mission_plan(plan)
    assert "panel_m2" in str(exc.value)

    plan = valid_mission_dict()
    plan["hardware"]["min_soc_fraction"] = 1.5
    with pytest.raises(ValidationError) as exc:
        validate_mission_plan(plan)
    assert "min_soc_fraction" in str(exc.value)


def test_site_not_in_library_rejected():
    plan = valid_mission_dict()
    plan["landing_site_id"] = "fictional_crater_99"
    with pytest.raises(ValidationError) as exc:
        validate_mission_plan(plan)
    assert "not found in library" in str(exc.value)


def test_launch_outside_spice_coverage():
    plan = valid_mission_dict()
    plan["launch_utc"] = "1850-01-01T00:00:00Z"
    with pytest.raises(ValidationError) as exc:
        validate_mission_plan(plan)
    assert "outside the ephemeris coverage" in str(exc.value)


def test_probabilities_sum_above_one_rejected():
    plan = valid_mission_dict()
    plan["delay_scenarios"] = [
        {"type": "launch_slip", "days": 1.0, "probability": 0.70},
        {"type": "transit_extension", "days": 1.0, "probability": 0.40},
    ]
    with pytest.raises(ValidationError) as exc:
        validate_mission_plan(plan)
    assert "exceeds 1.0" in str(exc.value)


def test_oversized_file_rejected():
    huge_bytes = b"{" + b'"mission": "a",' * 100_000 + b'"schema_version": 1}'
    assert len(huge_bytes) > MAX_FILE_BYTES
    with pytest.raises(ValidationError) as exc:
        validate_mission_plan(huge_bytes)
    assert "exceeds 1 MB limit" in str(exc.value)


def test_json_schema_generation():
    schema = generate_json_schema()
    assert schema["$schema"] == "http://json-schema.org/draft-07/schema#"
    assert "schema_version" in schema["required"]
    assert "shackleton_connecting_ridge" in schema["properties"]["landing_site_id"]["enum"]
