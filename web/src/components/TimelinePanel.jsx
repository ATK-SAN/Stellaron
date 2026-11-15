import { useMemo } from 'react'
import { Info } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer
} from 'recharts'
import {
  getTimelineHeadline,
  MEANING_LINES,
  DETAILS_DISCLOSURE,
  formatDurationFromHours,
  formatHoursTooltip
} from '../copy/results'

const MAX_POINTS = 500

function downsample(arr, maxLen) {
  if (!arr || arr.length <= maxLen) return arr
  const step = Math.ceil(arr.length / maxLen)
  const result = []
  for (let i = 0; i < arr.length; i += step) result.push(arr[i])
  return result
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <div style={{ marginBottom: 4, color: 'var(--text-muted)', fontSize: '0.68rem' }}>
        T+{label}h from study start
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
  const { chartData, transitions, toHoursFn } = useMemo(() => {
    if (!siteData) return { chartData: [], transitions: [], toHoursFn: () => 0 }

    const ts = siteData.time_series || {}
    const timesUtc = ts.times_utc || []
    const sunVis = ts.sun_visible || []
    const earthVis = ts.earth_visible || []

    if (!timesUtc.length) return { chartData: [], transitions: [], toHoursFn: () => 0 }

    const t0ms = new Date(timesUtc[0]).getTime()
    const toHours = utcStr => (new Date(utcStr).getTime() - t0ms) / 3_600_000

    // Downsample for rendering performance
    const n = timesUtc.length
    const step = n > MAX_POINTS ? Math.ceil(n / MAX_POINTS) : 1
    const sampled = []
    for (let i = 0; i < n; i += step) {
      sampled.push({
        t: parseFloat(toHours(timesUtc[i]).toFixed(2)),
        sun: sunVis[i] ? 1 : 0,
        earth: earthVis[i] ? 1 : 0,
      })
    }

    // Transitions — actual key in site JSON is siteData.transitions
    const trans = siteData.transitions || siteData.refined_transitions || []
    const transMarkers = trans.map(tr => ({
      t: tr.utc ? parseFloat(toHours(tr.utc).toFixed(2)) : parseFloat(((tr.epoch_et ?? tr.et ?? 0) / 3600).toFixed(2)),
      type: tr.type || tr.event || '',
    }))

    return { chartData: sampled, transitions: transMarkers, toHoursFn: toHours }
  }, [siteData])

  const summaryMetrics = useMemo(() => {
    const ts = siteData?.time_series || {}
    const sun = ts.sun_visible || []
    const earth = ts.earth_visible || []
    const n = sun.length || 1
    const sunPct = (sun.filter(Boolean).length / n) * 100
    const earthPct = (earth.filter(Boolean).length / n) * 100
    return { sunPct, earthPct, n }
  }, [siteData])

  const headline = useMemo(() => {
    return getTimelineHeadline({
      sunPct: summaryMetrics.sunPct,
      longestDarkH: site?.longest_darkness_hours ?? 0,
      earthPct: summaryMetrics.earthPct,
      longestBlackoutH: site?.longest_earth_blackout_hours ?? 0,
    })
  }, [summaryMetrics, site])

  const transitionList = siteData?.transitions || siteData?.refined_transitions || []
  const hasData = chartData.length > 0

  return (
    <div>
      {/* Headline Sentence (Rule 1 & A.4) */}
      <div className="headline-box">
        {headline}
      </div>

      {/* Details on Demand Disclosure (Rule 3) */}
      <details className="details-disclosure">
        <summary className="details-summary">
          <Info size={13} />
          <span>What does this mean?</span>
        </summary>
        <ul className="details-list">
          {DETAILS_DISCLOSURE.timeline.map((bullet, idx) => (
            <li key={idx}>{bullet}</li>
          ))}
        </ul>
      </details>

      {/* Metric Tiles (Rule 2: Responsive grid, plain label + value + meaning line, max 6 tiles) */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Sunlight (Sun)</div>
          <div className={`metric-value ${summaryMetrics.sunPct > 40 ? 'good' : summaryMetrics.sunPct > 20 ? 'warn' : 'bad'}`}>
            {summaryMetrics.sunPct.toFixed(1)}%
          </div>
          <div className="metric-meaning">{MEANING_LINES.sunVisible}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Earth link (DTE)</div>
          <div className={`metric-value ${summaryMetrics.earthPct > 50 ? 'good' : summaryMetrics.earthPct > 10 ? 'warn' : 'bad'}`}>
            {summaryMetrics.earthPct.toFixed(1)}%
          </div>
          <div className="metric-meaning">{MEANING_LINES.earthVisible}</div>
        </div>

        <div className="metric-card" title={formatHoursTooltip((site?.longest_darkness_hours ?? 0) * 3600)}>
          <div className="metric-label">Longest Darkness</div>
          <div className="metric-value warn">
            {formatDurationFromHours(site?.longest_darkness_hours)}
          </div>
          <div className="metric-meaning">{MEANING_LINES.longestDarkness}</div>
        </div>

        <div className="metric-card" title={formatHoursTooltip((site?.longest_earth_blackout_hours ?? 0) * 3600)}>
          <div className="metric-label">Earth Blackout</div>
          <div className="metric-value warn">
            {formatDurationFromHours(site?.longest_earth_blackout_hours)}
          </div>
          <div className="metric-meaning">{MEANING_LINES.earthBlackout}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Max Solar Elev.</div>
          <div className="metric-value neutral">
            {site?.max_solar_elevation_deg != null ? `${site.max_solar_elevation_deg.toFixed(2)}°` : '—'}
          </div>
          <div className="metric-meaning">{MEANING_LINES.maxSolarElev}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Transitions</div>
          <div className="metric-value neutral">
            {transitionList.length}
          </div>
          <div className="metric-meaning">{MEANING_LINES.transitions}</div>
        </div>
      </div>

      {/* Legend Chips (Rule 7) */}
      <div className="legend-row">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'rgba(255, 200, 50, 0.85)' }} />
          Sun visible
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'rgba(79, 195, 247, 0.85)' }} />
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
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
            <h3 style={{ margin: 0 }}>Sun & Earth Visibility Timeline</h3>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              Times are in hours since study start (UTC)
            </span>
          </div>
          <div className="chart-wrapper" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 15, left: -20, bottom: 5 }}>
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
                  tickCount={8}
                  label={{ value: 'Hours from study start', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 10 }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fontSize: 10 }}
                  domain={[0, 1]}
                  ticks={[0, 1]}
                  tickFormatter={v => (v === 1 ? 'YES' : 'NO')}
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
          {chartData.length < (siteData?.time_series?.times_utc?.length ?? 0) && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 6 }}>
              Downsampled to {chartData.length} of {siteData.time_series.times_utc.length} points for display
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

      {/* Transitions table (A.3.1 fix: siteData.transitions) */}
      {transitionList.length > 0 && (
        <div className="panel-section">
          <h3>Transitions ({transitionList.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem'
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Event</th>
                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>UTC Time</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right' }}>Precision</th>
                </tr>
              </thead>
              <tbody>
                {transitionList.slice(0, 30).map((tr, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(42,42,74,0.4)' }}>
                    <td style={{ padding: '4px 8px', color: 'var(--accent)', textTransform: 'capitalize' }}>
                      {tr.type || tr.event || '—'}
                    </td>
                    <td style={{ padding: '4px 8px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {tr.utc ? tr.utc.replace('T', ' ').slice(0, 19) : (tr.epoch_et ?? tr.et ?? 0).toFixed(0)}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {tr.precision_s != null ? `±${tr.precision_s}s` : '—'}
                    </td>
                  </tr>
                ))}
                {transitionList.length > 30 && (
                  <tr>
                    <td colSpan={3} style={{ padding: '4px 8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      … and {transitionList.length - 30} more transitions
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
