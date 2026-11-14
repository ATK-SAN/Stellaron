import { useMemo } from 'react'

/**
 * OrthographicPolarMap
 * 
 * An interactive 2D orthographic polar projection map of the Lunar South Pole (80°S to 90°S).
 * Shows:
 * - Concentric latitude circles (80°S, 85°S, 88°S, 90°S South Pole)
 * - Radial longitude spokes (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
 * - All Artemis South Pole candidate landing sites plotted at accurate polar coordinates
 * - Active solar terminator shadow boundary (rotates with current Sun azimuth)
 * - Color-coded site markers: gold if sunlit, cyan if in Earth line-of-sight, gray/dark if in shadow
 * - One-click selection of candidate sites
 */
export default function OrthographicPolarMap({
  sites,
  selectedSite,
  onSelectSite,
  sunAzDeg = 0,
  currentStep = 0,
  siteData = null
}) {
  const size = 320
  const center = size / 2
  const maxRadius = center - 24 // 80°S radius
  const poleLat = -90
  const outerLat = -80

  // Filter south polar sites (lat < -80)
  const polarSites = useMemo(() => {
    return (sites || []).filter(s => s.lat_deg <= -80)
  }, [sites])

  // Convert (lat, lon) to 2D canvas (x, y)
  // Distance from pole proportional to (90 - abs(lat))
  function latLonToPolarXY(lat, lon) {
    const r = ((Math.abs(lat) - 80) / (90 - 80)) * maxRadius
    // For South Pole, viewing from above South Pole:
    // Longitude 0° (Prime Meridian) faces North/Up, 90°E is Right, 180° is Down, 270°E (-90°) is Left
    const thetaRad = ((lon - 90) * Math.PI) / 180
    const x = center + (maxRadius - r) * Math.cos(thetaRad)
    const y = center + (maxRadius - r) * Math.sin(thetaRad)
    return { x, y }
  }

  // Solar terminator angle in polar projection
  const sunAngleRad = ((sunAzDeg - 90) * Math.PI) / 180
  const terminatorX1 = center + maxRadius * Math.cos(sunAngleRad + Math.PI / 2)
  const terminatorY1 = center + maxRadius * Math.sin(sunAngleRad + Math.PI / 2)
  const terminatorX2 = center + maxRadius * Math.cos(sunAngleRad - Math.PI / 2)
  const terminatorY2 = center + maxRadius * Math.sin(sunAngleRad - Math.PI / 2)

  return (
    <div style={{
      background: 'rgba(5, 8, 20, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '10px',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    }}>
      {/* Title */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.9rem' }}>🧭</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: '#f1f5f9'
          }}>
            South Pole Orthographic Map (80°S – 90°S)
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.62rem',
          color: '#38bdf8',
          background: 'rgba(56, 189, 248, 0.1)',
          padding: '2px 6px',
          borderRadius: '4px'
        }}>
          LOLA Stereographic
        </span>
      </div>

      {/* SVG Polar Grid */}
      <svg width={size} height={size} style={{ background: '#030611', borderRadius: '50%', border: '1px solid rgba(56,189,248,0.2)' }}>
        <defs>
          {/* Subtle night-side shading gradient based on solar vector */}
          <linearGradient id="solarShadowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(251, 191, 36, 0.08)" />
            <stop offset="50%" stopColor="rgba(0, 0, 0, 0)" />
            <stop offset="100%" stopColor="rgba(2, 6, 23, 0.65)" />
          </linearGradient>
        </defs>

        {/* Shaded Night Hemisphere */}
        <circle cx={center} cy={center} r={maxRadius} fill="#050814" />

        {/* Concentric Latitude Rings */}
        {[
          { lat: -80, r: maxRadius, label: '80°S' },
          { lat: -85, r: maxRadius * 0.5, label: '85°S' },
          { lat: -88, r: maxRadius * 0.2, label: '88°S' },
        ].map(ring => (
          <g key={ring.lat}>
            <circle
              cx={center}
              cy={center}
              r={ring.r}
              fill="none"
              stroke="rgba(100, 116, 139, 0.25)"
              strokeDasharray={ring.lat === -80 ? 'none' : '3,3'}
              strokeWidth={1}
            />
            <text
              x={center + ring.r - 2}
              y={center - 3}
              fill="#475569"
              fontSize="8px"
              fontFamily="var(--font-mono)"
              textAnchor="end"
            >
              {ring.label}
            </text>
          </g>
        ))}

        {/* Longitude Radial Spokes */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
          const rad = ((deg - 90) * Math.PI) / 180
          const x2 = center + maxRadius * Math.cos(rad)
          const y2 = center + maxRadius * Math.sin(rad)
          const labelX = center + (maxRadius + 12) * Math.cos(rad)
          const labelY = center + (maxRadius + 12) * Math.sin(rad) + 3
          return (
            <g key={deg}>
              <line
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke="rgba(100, 116, 139, 0.18)"
                strokeWidth={0.8}
              />
              <text
                x={labelX}
                y={labelY}
                fill="#475569"
                fontSize="7.5px"
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
          x1={terminatorX1}
          y1={terminatorY1}
          x2={terminatorX2}
          y2={terminatorY2}
          stroke="rgba(251, 191, 36, 0.4)"
          strokeDasharray="4,4"
          strokeWidth={1.5}
        />

        {/* Solar Direction Indicator Arrow */}
        <g transform={`translate(${center}, ${center}) rotate(${sunAzDeg})`}>
          <line x1={0} y1={0} x2={0} y2={-maxRadius + 5} stroke="rgba(251, 191, 36, 0.7)" strokeWidth={1.2} />
          <circle cx={0} cy={-maxRadius + 5} r={3.5} fill="#fbbf24" />
        </g>

        {/* True South Pole Marker (90.0°S) */}
        <circle cx={center} cy={center} r={3} fill="#38bdf8" />
        <text
          x={center}
          y={center + 12}
          fill="#38bdf8"
          fontSize="8px"
          fontFamily="var(--font-mono)"
          fontWeight="bold"
          textAnchor="middle"
        >
          SOUTH POLE (90°S)
        </text>

        {/* Candidate Sites Plotted */}
        {polarSites.map(s => {
          const { x, y } = latLonToPolarXY(s.lat_deg, s.lon_deg)
          const isSelected = selectedSite?.id === s.id
          const isSunlit = (s.sunlight_fraction ?? 0) > 0.35

          return (
            <g
              key={s.id}
              onClick={() => onSelectSite(s)}
              style={{ cursor: 'pointer' }}
            >
              {/* Outer pulsing ring for selected site */}
              {isSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r={9}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={1.8}
                  strokeDasharray="2,2"
                />
              )}

              {/* Site Node */}
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 5 : 3.5}
                fill={isSelected ? '#38bdf8' : isSunlit ? '#fbbf24' : '#94a3b8'}
                stroke="#030611"
                strokeWidth={1}
              />

              {/* Short Label */}
              <text
                x={x}
                y={y - 7}
                fill={isSelected ? '#38bdf8' : '#cbd5e1'}
                fontSize={isSelected ? '8px' : '7px'}
                fontFamily="var(--font-mono)"
                fontWeight={isSelected ? 'bold' : 'normal'}
                textAnchor="middle"
                style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
              >
                {s.name.split(' ')[0]}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Map Legend */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.62rem',
        color: '#64748b'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
          Selected Site
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
          Sunlit Zone
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '1.5px', background: '#fbbf24', display: 'inline-block', borderStyle: 'dashed' }} />
          Solar Terminator
        </span>
      </div>
    </div>
  )
}
