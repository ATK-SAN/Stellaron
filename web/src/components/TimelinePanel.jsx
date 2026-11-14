import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend
} from 'recharts'

const MAX_POINTS = 500

function downsample(arr, maxLen) {
  if (!arr || arr.length <= maxLen) return arr
  const step = Math.ceil(arr.length / maxLen)
  const result = []
  for (let i = 0; i < arr.length; i += step) result.push(arr[i])
  return result
}

function formatET(et) {
  // Convert ephemeris time (seconds) to a rough label
  // ET 0 = J2000.0 = 2000-01-01 12:00 TDB
  // We just show relative hours from first point
  return `${Math.round(et / 3600)}h`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <div style={{ marginBottom: 4, color: 'var(--text-muted)', fontSize: '0.68rem' }}>
        ET {label}h
      </div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value === 1 ? 'YES' : p.value === 0 ? 'NO' : p.value?.toFixed(3)}
        </div>
      ))}
    </div>
  )
}

export default function TimelinePanel({ siteData, site }) {
  const { chartData, transitions, refHour } = useMemo(() => {
    if (!siteData) return { chartData: [], transitions: [], refHour: 0 }

    const ts = siteData.time_series || {}
    const times = ts.times_et || []
    const sunVis = ts.sun_visible || []
    const earthVis = ts.earth_visible || []

    if (!times.length) return { chartData: [], transitions: [], refHour: 0 }

    const refHour = times[0] / 3600

    // Downsample
    const n = times.length
    const step = n > MAX_POINTS ? Math.ceil(n / MAX_POINTS) : 1
    const sampled = []
    for (let i = 0; i < n; i += step) {
      sampled.push({
        t: Math.round(times[i] / 3600 - refHour),
        sun: sunVis[i] ? 1 : 0,
        earth: earthVis[i] ? 1 : 0,
      })
    }

    // Transitions
    const trans = siteData.refined_transitions || []
    const transMarkers = trans.map(tr => ({
      t: Math.round((tr.et ?? tr.time_et ?? 0) / 3600 - refHour),
      type: tr.type || tr.event || '',
    }))

    return { chartData: sampled, transitions: transMarkers, refHour }
  }, [siteData])

  const summaryMetrics = useMemo(() => {
    const ts = siteData?.time_series || {}
    const sun = ts.sun_visible || []
    const earth = ts.earth_visible || []
    const n = sun.length || 1
    const sunPct = sun.filter(Boolean).length / n * 100
    const earthPct = earth.filter(Boolean).length / n * 100
    return { sunPct, earthPct, n }
  }, [siteData])

  const hasData = chartData.length > 0

  return (
    <div>
      {/* Summary metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">☀ Sun Visible</div>
          <div className={`metric-value ${summaryMetrics.sunPct > 40 ? 'good' : summaryMetrics.sunPct > 20 ? 'warn' : 'bad'}`}>
            {summaryMetrics.sunPct.toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {((summaryMetrics.sunPct / 100) * (siteData?.time_series?.times_et?.length ?? 0) * ((siteData?.study_interval_s ?? 600) / 3600)).toFixed(0)}h sunlit
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">🌍 Earth Visible</div>
          <div className={`metric-value ${summaryMetrics.earthPct > 50 ? 'good' : summaryMetrics.earthPct > 10 ? 'warn' : 'bad'}`}>
            {summaryMetrics.earthPct.toFixed(1)}%
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">🌑 Longest Darkness</div>
          <div className="metric-value warn">
            {site?.longest_darkness_hours?.toFixed(1) ?? '—'}h
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">📡 Earth Blackout</div>
          <div className="metric-value warn">
            {site?.longest_earth_blackout_hours?.toFixed(1) ?? '—'}h
          </div>
        </div>
        {site?.max_solar_elevation_deg != null && (
          <div className="metric-card">
            <div className="metric-label">☀ Max Solar Elev.</div>
            <div className="metric-value neutral">
              {site.max_solar_elevation_deg.toFixed(2)}°
            </div>
          </div>
        )}
        <div className="metric-card">
          <div className="metric-label">📊 Transitions</div>
          <div className="metric-value neutral">
            {(siteData?.refined_transitions?.length ?? 0)}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="legend-row">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'rgba(255, 200, 50, 0.7)' }} />
          Sun visible
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'rgba(79, 195, 247, 0.7)' }} />
          Earth visible
        </div>
        {transitions.length > 0 && (
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#ff6b6b', borderRadius: '0' }} />
            Transition event
          </div>
        )}
      </div>

      {/* Chart */}
      {hasData ? (
        <div className="panel-section">
          <h3>Sun & Earth Visibility Timeline</h3>
          <div className="chart-wrapper" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="sunGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffc832" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#ffc832" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="earthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4fc3f7" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#4fc3f7" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="t"
                  stroke="var(--text-muted)"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Hours from study start', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 10 }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fontSize: 10 }}
                  domain={[0, 1]}
                  ticks={[0, 1]}
                  tickFormatter={v => v === 1 ? 'YES' : 'NO'}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="stepAfter"
                  dataKey="sun"
                  name="Sun"
                  stroke="#ffc832"
                  strokeWidth={1.5}
                  fill="url(#sunGrad)"
                  isAnimationActive={false}
                />
                <Area
                  type="stepAfter"
                  dataKey="earth"
                  name="Earth"
                  stroke="#4fc3f7"
                  strokeWidth={1.5}
                  fill="url(#earthGrad)"
                  isAnimationActive={false}
                />
                {transitions.slice(0, 20).map((tr, i) => (
                  <ReferenceLine
                    key={i}
                    x={tr.t}
                    stroke="#ff6b6b"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    label={tr.type ? { value: tr.type.slice(0, 3), fill: '#ff6b6b', fontSize: 8 } : undefined}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {chartData.length < (siteData?.time_series?.times_et?.length ?? 0) && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 6 }}>
              Downsampled to {chartData.length} of {siteData.time_series.times_et.length} points for display
            </div>
          )}
        </div>
      ) : (
        <div className="panel-section">
          <div className="empty-state" style={{ height: 120 }}>
            <span>No time-series data available for this site</span>
          </div>
        </div>
      )}

      {/* Transitions table */}
      {siteData?.refined_transitions?.length > 0 && (
        <div className="panel-section">
          <h3>Refined Transitions ({siteData.refined_transitions.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem'
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Event</th>
                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Body</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right' }}>ET (s)</th>
                </tr>
              </thead>
              <tbody>
                {siteData.refined_transitions.slice(0, 30).map((tr, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(42,42,74,0.4)' }}>
                    <td style={{ padding: '4px 8px', color: 'var(--accent)' }}>
                      {tr.type || tr.event || '—'}
                    </td>
                    <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>
                      {tr.body || tr.target || '—'}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {(tr.et ?? tr.time_et ?? 0).toFixed(0)}
                    </td>
                  </tr>
                ))}
                {siteData.refined_transitions.length > 30 && (
                  <tr>
                    <td colSpan={3} style={{ padding: '4px 8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      … and {siteData.refined_transitions.length - 30} more transitions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
