/** tour.js — Centralized copy and step configuration for the STELLARON dashboard tour.
 *
 * Rules:
 * - Single source of truth for all tour copy.
 * - Every sentence strictly 15 words or fewer.
 * - Names match real app labels and tooltips.
 * - Neutral phrasing ('modelled', 'evaluates'), zero banned certainty claims.
 */

export const TOUR_PROMPT = {
  title: 'New here?',
  text: 'Take a 30-second tour of the flight controls.',
  startLabel: 'Start tour',
  skipLabel: 'Skip',
}

export const TOUR_STEPS = [
  {
    id: 'site-list',
    target: '[data-tour="site-list"]',
    icon: 'Compass',
    name: 'Candidate sites',
    sentence: 'Pick a landing site to evaluate. Click it again to deselect.',
    placement: 'right',
  },
  {
    id: 'search-filters',
    target: '[data-tour="search-filters"]',
    icon: 'Search',
    name: 'Search and filters',
    sentence: 'Find a site by name, or filter by Artemis, Apollo, or Far Side.',
    placement: 'right',
  },
  {
    id: 'viewport-tabs',
    target: '[data-tour="viewport-tabs"]',
    icon: 'Layers',
    name: 'Viewport tabs',
    sentence: 'Switch between Split 3D, Moon Globe, Ridge DTM, and Polar Radar views.',
    placement: 'bottom',
    items: [
      { name: 'Split 3D', desc: 'Side-by-side globe and local terrain.' },
      { name: 'Moon Globe', desc: 'Spin the globe to view site locations.' },
      { name: 'Ridge DTM', desc: '3D topographic relief of selected area.' },
      { name: 'Polar Radar', desc: 'Top-down polar map projection.' },
    ],
  },
  {
    id: 'labels-toggle',
    target: '[data-tour="labels-toggle"]',
    icon: 'Tag',
    name: 'Labels (L)',
    sentence: 'Toggle site names on the 3D globe. Press L anytime.',
    placement: 'bottom',
  },
  {
    id: 'right-panel',
    target: '[data-tour="right-panel"]',
    icon: 'Gauge',
    name: 'Site evaluation',
    sentence: 'Evaluates the selected site on sunlight, Earth link, slope, and terrain hazards.',
    placement: 'left',
  },
  {
    id: 'slip-slider',
    target: '[data-tour="slip-slider"]',
    icon: 'Sliders',
    name: 'Mission slip',
    sentence: 'Slide to model how launch delays alter surface illumination and comms.',
    placement: 'left',
  },
  {
    id: 'rail',
    target: '[data-tour="rail"]',
    icon: 'Compass',
    name: 'Mission workspaces',
    sentence: 'Navigate seven dedicated modules for celestial tracking, horizons, battery, and rehearsal.',
    placement: 'right',
    items: [
      { name: '3D Site Explorer', desc: 'Browse sites and terrain in 3D.' },
      { name: 'Sun & Earth Simulator', desc: 'Track celestial bodies in lunar sky.' },
      { name: 'Horizon Skyline', desc: 'Panoramic terrain horizon profile.' },
      { name: 'Illumination Timeline', desc: '30-day sunlight and Earth visibility.' },
      { name: 'Lander Battery Lab', desc: 'Model diurnal battery state of charge.' },
      { name: 'NASA Cross-Check', desc: 'Verify results against published benchmarks.' },
      { name: 'Mission Rehearsal', desc: 'Rehearse launch delays and descent trajectories.' },
    ],
  },
]

export const TOUR_HINTS = {
  finalHint: 'Reopen this tour anytime by pressing ? or clicking the help icon in the header.',
  back: 'Back',
  next: 'Next',
  done: 'Done',
  skip: 'Skip tour',
  replayTooltip: 'Quick tour (?)',
}
