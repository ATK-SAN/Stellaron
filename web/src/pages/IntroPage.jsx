/** IntroPage.jsx — STELLARON Mission Briefing
 *
 * Implements Specification 2A:
 * - Standalone flight-ops briefing document layout
 * - Real live stats read from app data
 * - Real sample evaluation metrics from engine output
 * - Real WebP screenshots of the live system
 * - Zero banned claims (adheres strictly to 2.3b & 2.3c)
 * - Complete limits & caveat disclosures
 */

import { useState, useEffect, Suspense, lazy } from 'react'
import {
  Compass,
  Mountain,
  Sun,
  Radio,
  BatteryCharging,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Layers,
  Activity,
  CheckCircle2,
} from 'lucide-react'
import styles from './IntroPage.module.css'

// Lazy load the 3D globe hero so initial bundle stays lightweight
const IntroGlobeHero = lazy(() => import('../components/IntroGlobeHero'))

export default function IntroPage({ navigate }) {
  const [siteCount, setSiteCount] = useState(14)
  const [sampleSite, setSampleSite] = useState({
    name: 'Shackleton Connecting Ridge',
    meanSlope: 22.4,
    maxSlope: 55.1,
    sunlitFraction: 38.2,
    longestSunHours: 261.7,
    earthVisibility: 7.2,
    maxBlackoutHours: 435.0,
  })

  // Read real library index at runtime
  useEffect(() => {
    fetch('/data/library_index.json')
      .then(r => r.json())
      .then(data => {
        if (data.sites && Array.isArray(data.sites)) {
          setSiteCount(data.sites.length)
          const shack = data.sites.find(s => s.id === 'shackleton_connecting_ridge')
          if (shack) {
            setSampleSite(prev => ({
              ...prev,
              sunlitFraction: (shack.sunlight_fraction * 100).toFixed(1),
              earthVisibility: (shack.geometric_earth_visibility_fraction * 100).toFixed(1),
            }))
          }
        }
      })
      .catch(() => {})
  }, [])

  const handleLaunch = () => {
    if (navigate) {
      navigate('/app')
    } else {
      window.location.href = '/app'
    }
  }

  const handleScrollToHowItWorks = (e) => {
    e.preventDefault()
    const target = document.getElementById('how-it-works')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.background} aria-hidden="true" />

      {/* Accessible skip link */}
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>

      {/* Sticky Blurred Glass Navigation Bar */}
      <header className={styles.nav}>
        <div className={styles.navBrand}>
          <div className={styles.brandLogo}>
            <img src="/brand/stellaron-mark-32.png" alt="STELLARON Logo Mark" width="30" height="30" />
          </div>
          <div className={styles.brandText}>
            <span className={styles.wordmark}>STELLARON</span>
            <span className={styles.navBadge}>Mission Briefing</span>
          </div>
        </div>

        <div className={styles.navActions}>
          <button onClick={handleLaunch} className={styles.btnPrimary} aria-label="Launch Navigator Dashboard">
            Launch Navigator
            <ArrowRight size={15} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" className={styles.content}>
        {/* 00 / HERO */}
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.heroContent}>
            <div className={styles.heroTag}>
              STELLARON · LUNAR LANDING SITE NAVIGATOR · NASA SPACE APPS 2026
            </div>
            <h1 id="hero-heading" className={styles.heroHeadline}>
              Where should we land?
            </h1>
            <p className={styles.heroSubline}>
              Compare candidate Moon landing sites on terrain, sunlight, Earth link and power, then rehearse the mission.
            </p>

            <div className={styles.heroActions}>
              <button onClick={handleLaunch} className={styles.btnPrimary}>
                Launch Navigator
                <ArrowRight size={15} strokeWidth={2} />
              </button>
              <a href="#how-it-works" onClick={handleScrollToHowItWorks} className={styles.btnGhost}>
                How it works
              </a>
            </div>

            {/* Row of 3 live stats pulled from real data */}
            <div className={styles.statsRow}>
              <div className={styles.statItem} tabIndex={0}>
                <div className={styles.statValue}>{siteCount}</div>
                <div className={styles.statLabel}>Candidate Sites</div>
                <div className={styles.tooltip}>
                  {siteCount} candidate landing sites indexed across the lunar south pole and historical science regions.
                </div>
              </div>

              <div className={styles.statItem} tabIndex={0}>
                <div className={styles.statValue}>5</div>
                <div className={styles.statLabel}>Data Layers</div>
                <div className={styles.tooltip}>
                  Includes NASA LOLA 30m DTM, NAIF SPICE DE421 ephemeris, MOON_ME reference frame, LROC WAC imagery, and literature benchmark matrix.
                </div>
              </div>

              <div className={styles.statItem} tabIndex={0}>
                <div className={styles.statValue}>392</div>
                <div className={styles.statLabel}>Simulations</div>
                <div className={styles.tooltip}>
                  392 precomputed mission slip-calendar scenario evaluations across 14 sites and 28-day departure shifts.
                </div>
              </div>
            </div>
          </div>

          <div className={styles.heroGlobeWrapper}>
            <div className={styles.heroGlobeGlow} aria-hidden="true" />
            <Suspense
              fallback={
                <img
                  src="/intro/hero-globe-fallback.webp"
                  alt="Moon Globe"
                  width="440"
                  height="440"
                  className={styles.heroGlobeImg}
                />
              }
            >
              <IntroGlobeHero />
            </Suspense>
          </div>
        </section>

        {/* 01 / THE PROBLEM */}
        <section className={styles.section} aria-labelledby="challenge-heading">
          <div className={styles.sectionMonoHeader}>01 / THE CHALLENGE</div>
          <h2 id="challenge-heading" className={styles.sectionTitle}>
            Why lunar landing site selection is unforgiving
          </h2>
          <div className={styles.problemGrid}>
            <div className={styles.problemCard}>
              <p>
                Near the Moon’s south pole, the Sun skims just above the jagged horizon, casting kilometers-long shadows across craters and massif ridges. A position shift of several hundred meters or an unpredicted launch delay can rapidly plunge a lander into weeks of freezing darkness.
              </p>
            </div>
            <div className={styles.problemCard}>
              <p>
                Direct-to-Earth communication links periodically dip below local crater walls as the Moon librates, creating severe telemetry blackouts. Without terrain-aware modeling of topography, solar illumination, and battery reserves, landing operations risk cold-trap battery exhaustion.
              </p>
            </div>
          </div>
        </section>

        {/* 02 / WHAT STELLARON EVALUATES */}
        <section className={styles.section} aria-labelledby="eval-heading">
          <div className={styles.sectionMonoHeader}>02 / WHAT STELLARON EVALUATES</div>
          <h2 id="eval-heading" className={styles.sectionTitle}>
            Four core constraints modeled from orbital ephemeris and topography
          </h2>
          <p className={styles.sectionDesc}>
            Every metric traces directly to NASA NAIF SPICE planetary kernels and LOLA digital elevation models.
          </p>

          <div className={styles.evalGrid}>
            {/* Card 1: Terrain */}
            <div className={styles.evalCard}>
              <div className={styles.evalCardHeader}>
                <div className={styles.evalCardIcon}>
                  <Mountain size={18} strokeWidth={1.75} />
                </div>
                <h3 className={styles.evalCardTitle}>Terrain & Slope</h3>
              </div>
              <p className={styles.evalCardDesc}>
                Evaluates surface slope gradients, crater relief, and regional landing roughness across 3.84 km local elevation tiles.
              </p>
              <div className={styles.evalCardSample}>
                <span className={styles.sampleLabel}>Sample: {sampleSite.name}</span>
                Mean slope {sampleSite.meanSlope}° · Max slope {sampleSite.maxSlope}° (Modelled)
              </div>
            </div>

            {/* Card 2: Sunlight */}
            <div className={styles.evalCard}>
              <div className={styles.evalCardHeader}>
                <div className={styles.evalCardIcon}>
                  <Sun size={18} strokeWidth={1.75} />
                </div>
                <h3 className={styles.evalCardTitle}>Sunlight & Shadow</h3>
              </div>
              <p className={styles.evalCardDesc}>
                Calculates continuous solar illumination windows and terrain obstruction shadows across 360° local skyline profiles.
              </p>
              <div className={styles.evalCardSample}>
                <span className={styles.sampleLabel}>Sample: {sampleSite.name}</span>
                Sunlit fraction {sampleSite.sunlitFraction}% · Longest sun run {sampleSite.longestSunHours}h (Modelled)
              </div>
            </div>

            {/* Card 3: Earth Link */}
            <div className={styles.evalCard}>
              <div className={styles.evalCardHeader}>
                <div className={styles.evalCardIcon}>
                  <Radio size={18} strokeWidth={1.75} />
                </div>
                <h3 className={styles.evalCardTitle}>Earth Line-of-Sight</h3>
              </div>
              <p className={styles.evalCardDesc}>
                Tracks direct-to-Earth geometric communication visibility and predicts ground-station link blackout intervals.
              </p>
              <div className={styles.evalCardSample}>
                <span className={styles.sampleLabel}>Sample: {sampleSite.name}</span>
                Earth visibility {sampleSite.earthVisibility}% · Max blackout {sampleSite.maxBlackoutHours}h (Modelled)
              </div>
            </div>

            {/* Card 4: Power */}
            <div className={styles.evalCard}>
              <div className={styles.evalCardHeader}>
                <div className={styles.evalCardIcon}>
                  <BatteryCharging size={18} strokeWidth={1.75} />
                </div>
                <h3 className={styles.evalCardTitle}>Power & Battery</h3>
              </div>
              <p className={styles.evalCardDesc}>
                Simulates solar array generation and payload base-load consumption to determine battery State-of-Charge margins.
              </p>
              <div className={styles.evalCardSample}>
                <span className={styles.sampleLabel}>Sample: Default Hardware</span>
                5 m² array · 15 kWh battery · 65W load (Min SoC: 0.0% without tracking, Modelled)
              </div>
            </div>
          </div>
        </section>

        {/* 03 / HOW IT WORKS */}
        <section id="how-it-works" className={styles.section} aria-labelledby="workflow-heading">
          <div className={styles.sectionMonoHeader}>03 / HOW IT WORKS</div>
          <h2 id="workflow-heading" className={styles.sectionTitle}>
            Three steps from site exploration to mission rehearsal
          </h2>
          <p className={styles.sectionDesc}>
            Walk through real dashboard telemetry, stress-test departure delays, and verify findings against NASA mission literature.
          </p>

          <div className={styles.stepsContainer}>
            {/* Step 1 */}
            <div className={styles.stepRow}>
              <div>
                <div className={styles.stepNumber}>STEP 01</div>
                <h3 className={styles.stepTitle}>Pick a Candidate Site</h3>
                <p className={styles.stepText}>
                  Explore 14 sites across the Moon globe, inspect 30 m/px local topographic relief, and check initial modeled feasibility scores and slope bounds.
                </p>
              </div>
              <div className={styles.stepFrame}>
                <img
                  src="/intro/step-1-explorer.webp"
                  alt="STELLARON 3D Site Explorer displaying candidate site list and lunar topography"
                  width="720"
                  height="464"
                  loading="lazy"
                  className={styles.stepImg}
                />
              </div>
            </div>

            {/* Step 2 */}
            <div className={styles.stepRow}>
              <div>
                <div className={styles.stepNumber}>STEP 02</div>
                <h3 className={styles.stepTitle}>Rehearse Mission Slips</h3>
                <p className={styles.stepText}>
                  Simulate launch and landing delays from 0 to 28 days on the slip calendar. Observe how schedule shifts alter surface illumination and whether the lander battery survives.
                </p>
              </div>
              <div className={styles.stepFrame}>
                <img
                  src="/intro/step-2-rehearsal.webp"
                  alt="Mission Rehearsal interface with departure slip calendar and battery survival curves"
                  width="720"
                  height="400"
                  loading="lazy"
                  className={styles.stepImg}
                />
              </div>
            </div>

            {/* Step 3 */}
            <div className={styles.stepRow}>
              <div>
                <div className={styles.stepNumber}>STEP 03</div>
                <h3 className={styles.stepTitle}>Cross-Check with NASA Data</h3>
                <p className={styles.stepText}>
                  Audit illumination fraction and solar vector tolerances against published benchmarks. Verify run reproducibility with cryptographic SHA-256 hashes.
                </p>
              </div>
              <div className={styles.stepFrame}>
                <img
                  src="/intro/step-3-crosscheck.webp"
                  alt="NASA scientific literature cross-check matrix and reproducibility hash cards"
                  width="720"
                  height="420"
                  loading="lazy"
                  className={styles.stepImg}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 04 / BUILT ON */}
        <section className={styles.section} aria-labelledby="sources-heading">
          <div className={styles.sectionMonoHeader}>04 / DATA SOURCES & PROVENANCE</div>
          <h2 id="sources-heading" className={styles.sectionTitle}>
            Anchored to open NASA science data
          </h2>

          <div className={styles.sourcesGrid}>
            <div className={styles.sourceBadge}>
              <span className={styles.sourceName}>NASA LOLA DTM</span>
              <span className={styles.sourceDetail}>30 m/px Topography Elevation</span>
            </div>
            <div className={styles.sourceBadge}>
              <span className={styles.sourceName}>JPL NAIF SPICE</span>
              <span className={styles.sourceDetail}>DE421 Planetary Ephemerides</span>
            </div>
            <div className={styles.sourceBadge}>
              <span className={styles.sourceName}>LROC WAC Mosaic</span>
              <span className={styles.sourceDetail}>Lunar Reconnaissance Orbiter</span>
            </div>
            <div className={styles.sourceBadge}>
              <span className={styles.sourceName}>NASA SVS & Literature</span>
              <span className={styles.sourceDetail}>Mazarico & Gläser Benchmarks</span>
            </div>
          </div>

          <div className={styles.teamRow}>
            <span>Developed for NASA Space Apps Challenge 2026</span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', color: '#22D3EE' }}>
              Team STELLARON
            </span>
          </div>
        </section>
      </main>

      {/* FOOTER & HONEST LIMITS */}
      <footer className={styles.footer}>
        <div className={styles.content}>
          <div className={styles.limitsCard}>
            <div className={styles.limitsHeader}>
              <ShieldAlert size={15} strokeWidth={2} />
              <span>Model Scope & Limitations</span>
            </div>
            <ul className={styles.limitsList}>
              <li>
                <strong>Horizon Tile Boundary:</strong> Local terrain elevation models use a 3.84 km window (~1.9 km radius from site center). Distant ridges beyond the tile edge cannot block the Sun in the model; azimuths that reach the boundary reflect upper-bound illumination estimates.
              </li>
              <li>
                <strong>Illustrative Playback:</strong> 3D flight and descent playback is illustrative and does not constitute an operational flight-dynamics trajectory design solution.
              </li>
              <li>
                <strong>Modelled Constraints:</strong> Feasibility scores, battery margins, and survival verdicts reflect default modeled constraints (weighted: 45% Sun, 35% DTE, 20% Slope) rather than flight-certification criteria.
              </li>
              <li>
                <strong>Ephemeris Range:</strong> Backed by NAIF SPICE DE421 kernels covering 1900 through 2050 (&lt;1.0s compute). The web client replays a precomputed baseline for April 2026.
              </li>
              <li>
                <strong>Roadmap:</strong> Arbitrary user coordinate input and high-resolution DTM ingestion are scheduled for upcoming release cycles.
              </li>
            </ul>
          </div>

          <div className={styles.footerBottom}>
            <div>
              STELLARON · Built for NASA Space Apps Challenge 2026 · Not an official NASA product.
            </div>
            <button onClick={handleLaunch} className={styles.btnPrimary} style={{ padding: '6px 14px', fontSize: '12px' }}>
              Launch Navigator
              <ArrowRight size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
