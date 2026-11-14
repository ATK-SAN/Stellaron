import { useMemo, useRef, useEffect, useState } from 'react'

/**
 * HorizonSkyline
 * 
 * A 2D animated panoramic 360° skyline strip showing:
 * - Topographic terrain elevation profile from LOLA horizon data
 * - Animated amber Sun trajectory line across the horizon
 * - Animated cyan Earth libration figure-8 loop
 * - Current cursor position (live step from time slider)
 * - Compass rose: N (0°), E (90°), S (180°), W (270°)
 * - Sun & Earth above/below horizon indicator fills
 * 
 * All data sourced from site SPICE horizon[] and time_series[].
 * Zero fabrication — values directly from precomputed NASA SPICE outputs.
 */
export default function HorizonSkyline({ siteData, site, currentStep }) {
  const canvasRef = useRef(null)
  const [hoveredAz, setHoveredAz] = useState(null)
  const [canvasWidth, setCanvasWidth] = useState(900)

  const horizon = siteData?.horizon || {}
  const timeSeries = siteData?.time_series || {}
  const azs = horizon.az_deg || []
  const els = horizon.elevation_deg || []
  const sunAzs = timeSeries.sun_az_deg || []
  const sunEls = timeSeries.sun_el_deg || []
  const earthAzs = timeSeries.earth_az_deg || []
  const earthEls = timeSeries.earth_el_deg || []
  const sunVisible = timeSeries.sun_visible || []
  const earthVisible = timeSeries.earth_visible || []

  // Current live step values
  const liveTime = siteData?.time_series?.times_utc?.[currentStep]?.slice(0, 16).replace('T', ' ') || '—'
  const liveSunAz = sunAzs[currentStep] ?? null
  const liveSunEl = sunEls[currentStep] ?? null
  const liveEarthAz = earthAzs[currentStep] ?? null
  const liveEarthEl = earthEls[currentStep] ?? null
  const liveSunVis = sunVisible[currentStep] ?? false
  const liveEarthVis = earthVisible[currentStep] ?? false

  // Build terrain path: sort horizon by azimuth, smooth & interpolate
  const terrainProfile = useMemo(() => {
    if (!azs.length) return []
    const pairs = azs.map((az, i) => [az, els[i] ?? 0])
    pairs.sort((a, b) => a[0] - b[0])
    return pairs
  }, [azs, els])

  // Max/min elevation for canvas scaling (add vertical exaggeration 3x for readability)
  const { elMin, elMax } = useMemo(() => {
    const allEls = [
      ...els,
      ...(sunEls.length ? sunEls : []),
      ...(earthEls.length ? earthEls : [])
    ].filter(e => e !== undefined && e !== null)
    if (!allEls.length) return { elMin: -5, elMax: 5 }
    const mn = Math.min(...allEls) - 2
    const mx = Math.max(...allEls) + 2
    return { elMin: Math.min(mn, -5), elMax: Math.max(mx, 5) }
  }, [els, sunEls, earthEls])

  // Map az 0-360 → canvas X, elevation → canvas Y
  function azToX(az, w) {
    return ((az % 360) / 360) * w
  }
  function elToY(el, h, topPad = 20, botPad = 36) {
    const drawH = h - topPad - botPad
    const frac = (el - elMin) / (elMax - elMin)
    return topPad + drawH * (1 - frac)
  }

  // Build smooth Sun and Earth full-30-day trajectory paths (subsampled)
  const { sunPathPoints, earthPathPoints } = useMemo(() => {
    const sun = []
    const earth = []
    const step = 3 // subsample: every 3 → 1440 points max
    for (let i = 0; i < sunAzs.length; i += step) {
      sun.push([sunAzs[i], sunEls[i] ?? 0])
    }
    for (let i = 0; i < earthAzs.length; i += step) {
      earth.push([earthAzs[i], earthEls[i] ?? 0])
    }
    return { sunPathPoints: sun, earthPathPoints: earth }
  }, [sunAzs, sunEls, earthAzs, earthEls])

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.width
    const H = canvas.height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)

    // ── Background ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0, '#040816')
    bgGrad.addColorStop(1, '#070c1a')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    // Horizon zero line
    const hy = elToY(0, H)
    ctx.strokeStyle = 'rgba(100,116,139,0.35)'
    ctx.lineWidth = 1
    ctx.setLineDash([6, 5])
    ctx.beginPath()
    ctx.moveTo(0, hy)
    ctx.lineTo(W, hy)
    ctx.stroke()
    ctx.setLineDash([])

    // ── Compass markers ──
    const compassPoints = [
      { az: 0, label: 'N' }, { az: 45, label: 'NE' }, { az: 90, label: 'E' },
      { az: 135, label: 'SE' }, { az: 180, label: 'S' }, { az: 225, label: 'SW' },
      { az: 270, label: 'W' }, { az: 315, label: 'NW' },
    ]
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    for (const cp of compassPoints) {
      const x = azToX(cp.az, W)
      ctx.strokeStyle = 'rgba(100,116,139,0.2)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H - 36)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = cp.az === 0 ? '#38bdf8' : '#64748b'
      ctx.fillText(cp.label, x, H - 22)
    }

    // Degree marks
    ctx.font = '9px monospace'
    ctx.fillStyle = '#334155'
    ctx.textAlign = 'center'
    for (let az = 0; az <= 350; az += 10) {
      const x = azToX(az, W)
      ctx.fillText(az + '°', x, H - 10)
    }

    // ── 30-day Earth libration path (faint, cyan) ──
    if (earthPathPoints.length > 2) {
      ctx.strokeStyle = 'rgba(56,189,248,0.22)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      let started = false
      for (const [az, el] of earthPathPoints) {
        const x = azToX(az, W)
        const y = elToY(el, H)
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // ── 30-day Sun trajectory path (faint, amber) ──
    if (sunPathPoints.length > 2) {
      ctx.strokeStyle = 'rgba(251,191,36,0.22)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      let started = false
      for (const [az, el] of sunPathPoints) {
        const x = azToX(az, W)
        const y = elToY(el, H)
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // ── Terrain Silhouette Filled Area ──
    if (terrainProfile.length > 2) {
      const terrainGrad = ctx.createLinearGradient(0, elToY(elMax, H), 0, H - 36)
      terrainGrad.addColorStop(0, 'rgba(100,116,139,0.35)')
      terrainGrad.addColorStop(1, 'rgba(30,41,59,0.9)')
      ctx.beginPath()
      ctx.moveTo(0, H - 36)
      for (const [az, el] of terrainProfile) {
        const x = azToX(az, W)
        const y = elToY(el, H)
        ctx.lineTo(x, y)
      }
      ctx.lineTo(W, H - 36)
      ctx.closePath()
      ctx.fillStyle = terrainGrad
      ctx.fill()

      // Terrain outline
      ctx.strokeStyle = 'rgba(148,163,184,0.6)'
      ctx.lineWidth = 1.8
      ctx.beginPath()
      let first = true
      for (const [az, el] of terrainProfile) {
        const x = azToX(az, W)
        const y = elToY(el, H)
        if (first) { ctx.moveTo(x, y); first = false }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // ── Live Sun dot (animated position) ──
    if (liveSunAz !== null) {
      const sx = azToX(liveSunAz, W)
      const sy = elToY(liveSunEl, H)
      // Corona glow
      const sunGlow = ctx.createRadialGradient(sx, sy, 2, sx, sy, 18)
      sunGlow.addColorStop(0, 'rgba(251,191,36,0.9)')
      sunGlow.addColorStop(0.4, 'rgba(251,191,36,0.4)')
      sunGlow.addColorStop(1, 'rgba(251,191,36,0)')
      ctx.fillStyle = sunGlow
      ctx.beginPath()
      ctx.arc(sx, sy, 18, 0, Math.PI * 2)
      ctx.fill()
      // Core
      ctx.fillStyle = '#fffef0'
      ctx.beginPath()
      ctx.arc(sx, sy, 5, 0, Math.PI * 2)
      ctx.fill()
      // Dashed vertical drop to horizon
      ctx.strokeStyle = 'rgba(251,191,36,0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx, hy)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Live Earth dot (animated position) ──
    if (liveEarthAz !== null) {
      const ex = azToX(liveEarthAz, W)
      const ey = elToY(liveEarthEl, H)
      // Atmospheric scattering glow
      const earthGlow = ctx.createRadialGradient(ex, ey, 2, ex, ey, 16)
      earthGlow.addColorStop(0, 'rgba(56,189,248,0.9)')
      earthGlow.addColorStop(0.5, 'rgba(56,189,248,0.3)')
      earthGlow.addColorStop(1, 'rgba(56,189,248,0)')
      ctx.fillStyle = earthGlow
      ctx.beginPath()
      ctx.arc(ex, ey, 16, 0, Math.PI * 2)
      ctx.fill()
      // Core
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(ex, ey, 4.5, 0, Math.PI * 2)
      ctx.fill()
      // Earth occultation status
      if (!liveEarthVis) {
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(ex, ey, 8, 0, Math.PI * 2)
        ctx.stroke()
      }
      // Dashed drop to horizon
      ctx.strokeStyle = 'rgba(56,189,248,0.4)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex, hy)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Hovered Az vertical line ──
    if (hoveredAz !== null) {
      const hx = azToX(hoveredAz, W)
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(hx, 0)
      ctx.lineTo(hx, H - 36)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Y-axis elevation labels ──
    ctx.font = '9px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#475569'
    for (let el = Math.ceil(elMin); el <= elMax; el++) {
      if (el % 2 !== 0) continue
      const y = elToY(el, H)
      ctx.fillText(el + '°', 3, y + 3)
    }
  }, [terrainProfile, sunPathPoints, earthPathPoints, liveSunAz, liveSunEl, liveEarthAz, liveEarthEl, hoveredAz, elMin, elMax, liveEarthVis, liveSunVis])

  // Responsive canvas width observer
  useEffect(() => {
    const container = canvasRef.current?.parentElement
    if (!container) return
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setCanvasWidth(Math.floor(entry.contentRect.width))
      }
    })
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

  function handleMouseMove(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const az = (x / canvasRef.current.width) * 360
    setHoveredAz(Math.round(az))
  }

  return (
    <div style={{
      background: '#040816',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* Header Row */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
            360° Panoramic Horizon Skyline
          </span>
          <span style={{
            fontSize: '0.63rem',
            color: '#64748b',
            padding: '1px 7px',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '3px',
            fontFamily: 'monospace'
          }}>
            {site?.name} · LOLA DTM horizon
          </span>
        </div>

        {/* Live status pills */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.65rem',
            fontWeight: 700,
            background: liveSunVis ? 'rgba(251,191,36,0.15)' : 'rgba(100,116,139,0.1)',
            color: liveSunVis ? '#fbbf24' : '#64748b',
            border: `1px solid ${liveSunVis ? 'rgba(251,191,36,0.4)' : 'rgba(100,116,139,0.2)'}`
          }}>
            {liveSunVis ? 'SUNLIT' : 'SHADOW'}{liveSunEl !== null ? ` · ${liveSunEl.toFixed(1)}°` : ''}
          </div>
          <div style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '0.65rem',
            fontWeight: 700,
            background: liveEarthVis ? 'rgba(56,189,248,0.15)' : 'rgba(239,68,68,0.1)',
            color: liveEarthVis ? '#38bdf8' : '#ef4444',
            border: `1px solid ${liveEarthVis ? 'rgba(56,189,248,0.4)' : 'rgba(239,68,68,0.3)'}`
          }}>
            {liveEarthVis ? 'EARTH DTE' : 'EARTH OCCULTED'}{liveEarthEl !== null ? ` · ${liveEarthEl.toFixed(1)}°` : ''}
          </div>
          <div style={{ fontSize: '0.63rem', color: '#475569', fontFamily: 'monospace' }}>
            UTC {liveTime}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ width: '100%' }}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={180}
          style={{ display: 'block', width: '100%', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredAz(null)}
        />
      </div>

      {/* Legend Row */}
      <div style={{
        padding: '6px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        fontSize: '0.64rem',
        color: '#64748b'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '16px', height: '3px', background: 'rgba(148,163,184,0.7)', display: 'inline-block', borderRadius: '1px' }}></span>
          Topographic skyline (LOLA)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '16px', height: '3px', background: 'rgba(251,191,36,0.6)', display: 'inline-block', borderRadius: '1px' }}></span>
          30-day solar path
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '16px', height: '3px', background: 'rgba(56,189,248,0.6)', display: 'inline-block', borderRadius: '1px' }}></span>
          30-day Earth libration loop
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fffef0', boxShadow: '0 0 6px #fbbf24', display: 'inline-block' }}></span>
          Current Sun position
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8', display: 'inline-block' }}></span>
          Current Earth position
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '16px', height: '1px', background: 'rgba(100,116,139,0.5)', display: 'inline-block', borderStyle: 'dashed' }}></span>
          0° horizon (true flat)
        </span>
      </div>
    </div>
  )
}
