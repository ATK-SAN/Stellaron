"""Scenario application module for STELLARON Mission Rehearsal (Section 4).

Applies a delay_scenario perturbation to a baseline mission plan and returns
a modified plan with templated plain-English change sentences.
Never uses 'recommended', 'best', 'optimal', 'predicted', or 'guaranteed'.
"""

from copy import deepcopy
from typing import Any, Dict, List, Optional, Tuple


# Scenario types and their effect descriptions (neutral language only)
SCENARIO_TYPE_TEMPLATES = {
    "launch_slip": "Launch slipped by {days} day(s). All subsequent phases shift forward.",
    "transit_extension": "Transit extended by {days} day(s). Orbit arrival and surface phases shift.",
    "orbit_hold_extension": "Orbit hold extended by {days} day(s). Descent and surface phases shift.",
    "landing_retry": "Landing retry added {days} day(s). Surface start shifts.",
    "reduced_power": "Solar panel output reduced to {power_factor:.0%} of nominal capacity.",
    "comms_outage": "Communications outage of {outage_hours}h starting at {outage_start_utc}.",
}


def apply_scenario(
    plan: Dict[str, Any],
    scenario: Dict[str, Any],
) -> Tuple[Dict[str, Any], str]:
    """Apply a single delay scenario to a baseline plan.

    Args:
        plan: Validated baseline mission plan.
        scenario: A single delay scenario dict with 'type' and relevant fields.

    Returns:
        (modified_plan, change_sentence)
        modified_plan: Deep copy of plan with the scenario perturbation applied.
        change_sentence: Plain-English description of what changed (neutral language).
    """
    modified = deepcopy(plan)
    s_type = scenario.get("type", "")
    days = float(scenario.get("days", 0.0))

    if s_type == "launch_slip":
        # Shift launch date forward
        from rehearsal.timeline import parse_utc_dt, format_utc_iso
        from datetime import timedelta
        launch_dt = parse_utc_dt(modified["launch_utc"])
        new_launch_dt = launch_dt + timedelta(days=days)
        modified["launch_utc"] = format_utc_iso(new_launch_dt)
        sentence = SCENARIO_TYPE_TEMPLATES["launch_slip"].format(days=days)

    elif s_type == "transit_extension":
        modified["transit_days"] = float(modified.get("transit_days", 3.0)) + days
        sentence = SCENARIO_TYPE_TEMPLATES["transit_extension"].format(days=days)

    elif s_type == "orbit_hold_extension":
        modified["orbit_hold_days"] = float(modified.get("orbit_hold_days", 0.0)) + days
        sentence = SCENARIO_TYPE_TEMPLATES["orbit_hold_extension"].format(days=days)

    elif s_type == "landing_retry":
        # Model as extending orbit hold (landing retry delays touchdown)
        modified["orbit_hold_days"] = float(modified.get("orbit_hold_days", 0.0)) + days
        sentence = SCENARIO_TYPE_TEMPLATES["landing_retry"].format(days=days)

    elif s_type == "reduced_power":
        power_factor = float(scenario.get("power_factor", 1.0))
        hw = modified.get("hardware", {})
        original_eff = float(hw.get("panel_efficiency", 0.28))
        hw["panel_efficiency"] = round(original_eff * power_factor, 6)
        modified["hardware"] = hw
        sentence = SCENARIO_TYPE_TEMPLATES["reduced_power"].format(power_factor=power_factor)

    elif s_type == "comms_outage":
        outage_hours = float(scenario.get("outage_hours", 0.0))
        outage_start = scenario.get("outage_start_utc", "unknown")
        # Comms outage doesn't modify the plan structure, it's metadata for the evaluation
        if "scenario_metadata" not in modified:
            modified["scenario_metadata"] = {}
        modified["scenario_metadata"]["comms_outage"] = {
            "outage_start_utc": outage_start,
            "outage_hours": outage_hours,
        }
        sentence = SCENARIO_TYPE_TEMPLATES["comms_outage"].format(
            outage_hours=outage_hours, outage_start_utc=outage_start
        )

    else:
        sentence = f"Unknown scenario type '{s_type}'. No modification applied."

    return modified, sentence


def apply_all_scenarios(
    plan: Dict[str, Any],
    scenarios: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Apply each delay scenario independently to the baseline plan.

    Each scenario is applied individually to the baseline (not stacked),
    returning one modified plan per scenario plus the unmodified baseline.

    Args:
        plan: Validated baseline mission plan.
        scenarios: List of delay scenario dicts from plan["delay_scenarios"].

    Returns:
        List of scenario result dicts:
        [{
            "label": str,
            "scenario": dict or None (None for baseline),
            "modified_plan": dict,
            "change_sentence": str,
        }]
    """
    results = [{
        "label": "Baseline (nominal)",
        "scenario": None,
        "modified_plan": deepcopy(plan),
        "change_sentence": "Nominal mission plan with no perturbations.",
    }]

    if not scenarios:
        return results

    for i, scenario in enumerate(scenarios):
        s_type = scenario.get("type", "unknown")
        label = f"Scenario {i + 1}: {s_type.replace('_', ' ').title()}"
        modified_plan, change_sentence = apply_scenario(plan, scenario)
        results.append({
            "label": label,
            "scenario": scenario,
            "modified_plan": modified_plan,
            "change_sentence": change_sentence,
        })

    return results
