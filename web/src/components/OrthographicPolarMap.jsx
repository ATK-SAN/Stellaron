/** OrthographicPolarMap.jsx — Lunar South Pole Polar Radar Map (80°S – 90°S)
 *
 * Implements Specification 6b.A:
 * - Polar Azimuthal Equidistant projection (0° Up, +East Clockwise)
 * - Concentric latitude rings at 80°S, 85°S, 88°S with distance from pole in km
 * - Longitude spokes every 30°
 * - Interactive zoom (1x to 3x) with "Zoom to 88°–90°S" toggle
 * - Decluttered labels with leader line on selection/hover & side site key
 * - Out-of-bounds notification with "Switch to Moon Globe" button for non-polar sites
 * - Real legend with semantic status colors (zero emojis)
 */

import { useState, useMemo, useRef } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Globe,
  Sun,
  Radio,
  Mountain,
  Compass,
  Layers,
} from 'lucide-react'

// Constants
const R_MOON_KM = 1737.4
const BASE_RADIUS = 240 // radius of 80°S at 1x zoom

/**
 * Converts lunar latitude/longitude to 2D Polar Azimuthal Equidistant coordinates
 * Origin (0,0) is at South Pole (90°S)
 * 0° Longitude is UP (-Y), 90°E is RIGHT (+X), 180° is DOWN (+Y), 270°E is LEFT (-X)
 */
export function latLonToPolarXY(lat, lon, maxRadius = BASE_RADIUS) {
  // Distance from pole in degrees: (90 - |lat|)
  const degFromPole = Math.max(0, 90 - Math.abs(lat))
  // Radius proportional to angular distance: 10 degrees (80°S to 90°S) maps to maxRadius
  const r = (degFromPole / 10.0) * maxRadius

  // Angle: 0° is North/Up (-Y), +East is Clockwise
  const thetaRad = ((lon - 90) * Math.PI) / 180
  const x = r * Math.cos(thetaRad)
  const y = r * Math.sin(thetaRad)

  return { x, y, r, degFromPole }
}

export function getDistanceFromPoleKm(lat) {
  const degFromPole = Math.max(0, 90 - Math.abs(lat))
  return Math.round(degFromPole * (Math.PI / 180) * R_MOON_KM)
}

export default function OrthographicPolarMap({
  sites = [],
  selectedSite = null,
  onSelectSite,
  sunAzDeg = 0,
  siteData = null,
  onSwitchToGlobe,
}) {
  const [zoomLevel, setZoomLevel] = useState(1.0)
  const [hoveredSite, setHoveredSite] = useState(null)
  const [showKeyList, setShowKeyList] = useState(false)

  // Filter south polar sites (lat <= -80)
  const polarSites = useMemo(() => {
    return (sites || []).filter(s => s.lat_deg <= -80.0)
  }, [sites])

  const isSelectedSiteOnMap = selectedSite && selectedSite.lat_deg <= -80.0

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel(z => Math.min(3.0, +(z + 0.5).toFixed(1)))
  const handleZoomOut = () => setZoomLevel(z => Math.max(1.0, +(z - 0.5).toFixed(1)))
  const handleResetZoom = () => setZoomLevel(1.0)
  const handleZoomCluster = () => setZoomLevel(z => (z > 1.8 ? 1.0 : 2.5))

  // Radius scale
  const currentMaxR = BASE_RADIUS * zoomLevel

  // Solar angle & terminator coordinates in polar projection
  const sunAngleRad = ((sunAzDeg - 90) * Math.PI) / 180
  const termX1 = currentMaxR * Math.cos(sunAngleRad + Math.PI / 2)
  const termY1 = currentMaxR * Math.sin(sunAngleRad + Math.PI / 2)
  const termX2 = currentMaxR * Math.cos(sunAngleRad - Math.PI / 2)
  const termY2 = currentMaxR * Math.sin(sunAngleRad - Math.PI / 2)

  // Concentric Rings definition
  const rings = [
    { lat: -88, deg: 2, label: '88°S', distKm: getDistanceFromPoleKm(-88) },
    { lat: -85, deg: 5, label: '85°S', distKm: getDistanceFromPoleKm(-85) },
    { lat: -80, deg: 10, label: '80°S', distKm: getDistanceFromPoleKm(-80) },
  ]

  // Spokes every 30 degrees
  const spokes = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-bg)',
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border)',
    }}>
      {/* ── Top Bar: Title & Controls ── */}
      <div style={{
        height: '44px',
        padding: '0 16px',
        background: 'var(--color-panel-glass)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
        flexShrink: 0,
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass size={14} strokeWidth={1.5} style={{ color: 'var(--color-cyan)' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            South Pole Polar Radar Map (80°S – 90°S)
          </span>
          <span style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--color-border-subtle)',
            padding: '2px 6px',
            borderRadius: '4px',
          }}>
            Azimuthal Equidistant
          </span>
        </div>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleZoomCluster}
            className={`btn ${zoomLevel >= 2.0 ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '3px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
            title="Zoom to dense pole cluster (88°S–90°S)"
          >
            {zoomLevel >= 2.0 ? 'Overview (80°S)' : 'Pole Cluster (88°S)'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3.0}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '4px 6px', cursor: 'pointer' }}
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', padding: '0 4px', minWidth: '32px', textAlign: 'center' }}>
              {zoomLevel}x
            </span>
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1.0}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '4px 6px', cursor: 'pointer' }}
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={handleResetZoom}
              style={{ background: 'transparent', border: 'none', borderLeft: '1px solid var(--color-border)', color: 'var(--text-tertiary)', padding: '4px 6px', cursor: 'pointer' }}
              title="Reset Zoom"
              aria-label="Reset Zoom"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          <button
            onClick={() => setShowKeyList(!showKeyList)}
            className={`btn ${showKeyList ? 'btn-secondary' : 'btn-ghost'}`}
            style={{ padding: '3px 8px', fontSize: '11px' }}
          >
            Site Key ({polarSites.length})
          </button>
        </div>
      </div>

      {/* ── Center Area: SVG Radar Canvas + Out of Bounds Warning ── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {/* Out of bounds note if non-polar site is selected */}
        {!isSelectedSiteOnMap && selectedSite && (
          <div style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 15,
            background: 'var(--color-panel-glass)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--color-caution-border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
              <strong>{selectedSite.name}</strong> is at{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-caution)' }}>
                {Math.abs(selectedSite.lat_deg).toFixed(1)}°{selectedSite.lat_deg >= 0 ? 'N' : 'S'}
              </span>
              , outside this 80°S–90°S polar projection.
            </div>
            {onSwitchToGlobe && (
              <button
                onClick={onSwitchToGlobe}
                className="btn btn-secondary"
                style={{ padding: '3px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Globe size={12} strokeWidth={1.5} />
                <span>Switch to Moon Globe</span>
              </button>
            )}
          </div>
        )}

        {/* SVG Projection Canvas */}
        <svg
          viewBox="-300 -300 600 600"
          style={{
            width: '100%',
            height: '100%',
            maxHeight: 'min(100%, 640px)',
            background: '#040711',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <defs>
            {/* Geometric Daylight Gradient */}
            <linearGradient id="daylightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(245, 158, 11, 0.08)" />
              <stop offset="50%" stopColor="rgba(245, 158, 11, 0.02)" />
              <stop offset="100%" stopColor="rgba(5, 7, 13, 0.70)" />
            </linearGradient>
          </defs>

          {/* Background Polar Disk */}
          <circle cx={0} cy={0} r={currentMaxR} fill="#060914" stroke="rgba(255, 255, 255, 0.12)" strokeWidth={1} />

          {/* Geometric Daylight Shading */}
          <circle cx={0} cy={0} r={currentMaxR} fill="url(#daylightGrad)" />

          {/* Concentric Latitude Rings with Distance Labels */}
          {rings.map(ring => {
            const r = (ring.deg / 10.0) * currentMaxR
            return (
              <g key={ring.lat}>
                <circle
                  cx={0}
                  cy={0}
                  r={r}
                  fill="none"
                  stroke={ring.lat === -80 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)'}
                  strokeDasharray={ring.lat === -80 ? 'none' : '3,3'}
                  strokeWidth={1}
                />
                {/* Latitude and Distance Annotation */}
                <text
                  x={r - 4}
                  y={-4}
                  fill="var(--text-tertiary)"
                  fontSize="9px"
                  fontFamily="var(--font-mono)"
                  textAnchor="end"
                >
                  {ring.label} ({ring.distKm} km)
                </text>
              </g>
            )
          })}

          {/* Longitude Radial Spokes Every 30 Degrees */}
          {spokes.map(deg => {
            const rad = ((deg - 90) * Math.PI) / 180
            const x2 = currentMaxR * Math.cos(rad)
            const y2 = currentMaxR * Math.sin(rad)
            const labelX = (currentMaxR + 16) * Math.cos(rad)
            const labelY = (currentMaxR + 16) * Math.sin(rad) + 3
            return (
              <g key={deg}>
                <line
                  x1={0}
                  y1={0}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeWidth={0.75}
                />
                <text
                  x={labelX}
                  y={labelY}
                  fill="var(--text-muted)"
                  fontSize="8.5px"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                >
                  {deg}°
                </text>
              </g>
            )
          })}

          {/* Solar Terminator Line */}
          <line
            x1={termX1}
            y1={termY1}
            x2={termX2}
            y2={termY2}
            stroke="rgba(245, 158, 11, 0.35)"
            strokeDasharray="4,4"
            strokeWidth={1.2}
          />

          {/* Sub-Solar Vector Direction Indicator Arrow */}
          <g transform={`rotate(${sunAzDeg})`}>
            <line x1={0} y1={0} x2={0} y2={-currentMaxR + 8} stroke="rgba(245, 158, 11, 0.75)" strokeWidth={1.2} />
            <polygon
              points={`0,${-currentMaxR} -4,${-currentMaxR + 10} 4,${-currentMaxR + 10}`}
              fill="#F59E0B"
            />
          </g>

          {/* True South Pole Marker (90°S) */}
          <circle cx={0} cy={0} r={3} fill="var(--color-cyan)" />
          <text
            x={0}
            y={12}
            fill="var(--color-cyan)"
            fontSize="8px"
            fontFamily="var(--font-mono)"
            fontWeight="bold"
            textAnchor="middle"
          >
            SOUTH POLE (90°S)
          </text>

          {/* Candidate Polar Sites Markers */}
          {polarSites.map(s => {
            const { x, y } = latLonToPolarXY(s.lat_deg, s.lon_deg, currentMaxR)
            const isSelected = selectedSite?.id === s.id
            const isHovered = hoveredSite?.id === s.id
            const isLit = s.sunlight_fraction > 0.25 // terrain-aware baseline

            return (
              <g
                key={s.id}
                onClick={() => onSelectSite && onSelectSite(s)}
                onMouseEnter={() => setHoveredSite(s)}
                onMouseLeave={() => setHoveredSite(null)}
                style={{ cursor: 'pointer' }}
                tabIndex={0}
                role="button"
                aria-label={`Select ${s.name}`}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectSite && onSelectSite(s)
                  }
                }}
              >
                {/* Hit Target Expansion */}
                <circle cx={x} cy={y} r={12} fill="transparent" />

                {/* Selection Rings */}
                {isSelected && (
                  <circle
                    cx={x}
                    cy={y}
                    r={8}
                    fill="none"
                    stroke="var(--color-cyan)"
                    strokeWidth={1.5}
                    strokeDasharray="2,2"
                  />
                )}

                {/* Marker Dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 4.5 : isHovered ? 4 : 3}
                  fill={isLit ? '#F59E0B' : '#6B7280'}
                  stroke={isSelected ? '#22D3EE' : '#111827'}
                  strokeWidth={1}
                />

                {/* Interactive Leader Line & Callout on Hover or Selection */}
                {(isSelected || isHovered) && (
                  <g pointerEvents="none">
                    <line
                      x1={x}
                      y1={y}
                      x2={x + (x >= 0 ? 24 : -24)}
                      y2={y - 18}
                      stroke="var(--color-cyan)"
                      strokeWidth={1}
                    />
                    <circle cx={x + (x >= 0 ? 24 : -24)} cy={y - 18} r={2} fill="var(--color-cyan)" />
                    <rect
                      x={x >= 0 ? x + 26 : x - 130}
                      y={y - 30}
                      width={104}
                      height={24}
                      rx={4}
                      fill="rgba(17, 24, 39, 0.92)"
                      stroke="var(--color-border-cyan)"
                      strokeWidth={1}
                    />
                    <text
                      x={x >= 0 ? x + 32 : x - 124}
                      y={y - 14}
                      fill="var(--text-primary)"
                      fontSize="9px"
                      fontFamily="var(--font-sans)"
                      fontWeight="bold"
                    >
                      {s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        {/* Side / Overlay Site Key List */}
        {showKeyList && (
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            bottom: 12,
            width: '240px',
            background: 'var(--color-panel-glass)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 20,
            overflowY: 'auto',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Plotted Polar Sites
            </div>
            {polarSites.map(s => {
              const dist = getDistanceFromPoleKm(s.lat_deg)
              const isSelected = selectedSite?.id === s.id
              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSite && onSelectSite(s)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'rgba(34, 211, 238, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isSelected ? 'var(--color-cyan-border)' : 'var(--color-border-subtle)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? 'var(--color-cyan)' : 'var(--text-primary)' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {dist} km from pole
                    </div>
                  </div>
                  <span className={`status-chip ${s.coverage === 'hero' ? 'status-chip-safe' : 'status-chip-caution'}`}>
                    {s.coverage}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Bottom Bar: Legend & Convention Note ── */}
      <div style={{
        padding: '8px 16px',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
      }}>
        {/* Convention note */}
        <span>
          View from above South Pole · 0° Prime Meridian North/Up · +East Clockwise · Simulation Epoch: April 2026
        </span>

        {/* Semantic Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {isSelectedSiteOnMap && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid var(--color-cyan)' }} />
              <span>Selected Site</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B' }} />
            <span>Lit (Terrain-aware)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6B7280' }} />
            <span>Shadow</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 14, height: 0, borderTop: '1.5px dashed rgba(245, 158, 11, 0.5)' }} />
            <span>Terminator</span>
          </div>
        </div>
      </div>
    </div>
  )
}
