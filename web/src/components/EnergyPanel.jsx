import { useMemo } from 'react'
import { Info } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ReferenceArea
} from 'recharts'
import {
  getBatteryHeadline,
  MEANING_LINES,
  GLOSSARY,
  DETAILS_DISCLOSURE,
  formatDuration,
  formatHoursTooltip,
  formatWh
} from '../copy/results'

const MAX_POINTS = 500

function downsample(arr, maxLen) {
  if (!arr || arr.length <= maxLen) return arr
  const step = Math.ceil(arr.length / maxLen)
  const result = []
  for (let i = 0; i < arr.length; i += step) result.push(arr[i])
  return result
}

function getSocColor(soc) {
  if (soc < 0.2) return 'var(--danger)'
  if (soc < 0.5) return 'var(--warning)'
  return 'var(--success)'
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const soc = payload[0]?.value
  return (
    <div className="custom-tooltip">
      <div style={{ marginBottom: 4, color: 'var(--text-muted)', fontSize: '0.68rem' }}>T+{label}h</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: getSocColor(p.value) }}>
          {p.name}: {(p.value * 100).toFixed(1)}%
        </div>
      ))}
    </div>
  )
}

export default function EnergyPanel({ siteData, site }) {
  const energy = siteData?.metrics?.energy || {}

  const { socData, deficitIntervals } = useMemo(() => {
    const ts = siteData?.time_series || {}
    const socHistory = energy?.soc_history || []
    const socStep = energy?.soc_history_step ?? 1
    const deficits = energy?.deficit_intervals || []

    const timesUtc = ts.times_utc || []
    const t0ms = timesUtc.length ? new Date(timesUtc[0]).getTime() : 0

    if (!socHistory.length) {
      return { socData: [], deficitIntervals: deficits }
    }

    const n = socHistory.length
    const step = n > MAX_POINTS ? Math.ceil(n / MAX_POINTS) : 1
    const sampled = []
    for (let i = 0; i < n; i += step) {
      const origIdx = i * socStep
      const tHours = timesUtc.length && origIdx < timesUtc.length
        ? (new Date(timesUtc[origIdx]).getTime() - t0ms) / 3_600_000
        : origIdx * socStep * 10 / 3600
      sampled.push({ t: parseFloat(tHours.toFixed(2)), soc: socHistory[i] ?? 0 })
    }

    return { socData: sampled, deficitIntervals: deficits }
  }, [siteData, energy])

  const socStatus = energy.min_soc != null
    ? energy.min_soc < 0.2 ? 'bad' : energy.min_soc < 0.5 ? 'warn' : 'good'
    : 'neutral'

  const headline = useMemo(() => {
    const isCensored = deficitIntervals.some(d => d.censored)
    return getBatteryHeadline({
      minSoc: energy.min_soc,
      reserveFrac: 0.2,
      timeBelowReserveS: energy.time_below_reserve_s ?? 0,
      isCensored,
    })
  }, [energy, deficitIntervals])

  const hasData = socData.length > 0
  const netEnergyWh = energy.net_wh ?? ((energy.generated_wh ?? 0) - (energy.consumed_wh ?? 0))

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
          {DETAILS_DISCLOSURE.battery.map((bullet, idx) => (
            <li key={idx}>{bullet}</li>
          ))}
        </ul>
      </details>

      {/* Metric Tiles (Rule 2: Responsive grid, plain label + value + meaning line, max 6 tiles) */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Solar Generated</div>
          <div className="metric-value good">{formatWh(energy.generated_wh)}</div>
          <div className="metric-meaning">{MEANING_LINES.generated}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Energy Demanded</div>
          <div className="metric-value neutral">{formatWh(energy.consumed_wh)}</div>
          <div className="metric-meaning">{MEANING_LINES.demanded}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Battery Level (SoC)</div>
          <div className={`metric-value ${socStatus}`}>
            {energy.min_soc != null ? `${(energy.min_soc * 100).toFixed(1)}%` : '—'}
          </div>
          <div className="metric-meaning">{MEANING_LINES.minSoc}</div>
        </div>

        <div className="metric-card" title={formatHoursTooltip(energy.time_below_reserve_s)}>
          <div className="metric-label">Time Below Reserve</div>
          <div className={`metric-value ${energy.time_below_reserve_s > 0 ? 'bad' : 'good'}`}>
            {formatDuration(energy.time_below_reserve_s)}
          </div>
          <div className="metric-meaning">{MEANING_LINES.belowReserve}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Net Energy</div>
          <div className={`metric-value ${netEnergyWh >= 0 ? 'good' : 'bad'}`}>
            {formatWh(netEnergyWh)}
          </div>
          <div className="metric-meaning">{MEANING_LINES.netEnergy}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Deficit Events</div>
          <div className={`metric-value ${deficitIntervals.length > 0 ? 'bad' : 'good'}`}>
            {deficitIntervals.length}
          </div>
          <div className="metric-meaning">{MEANING_LINES.deficitEvents}</div>
        </div>
      </div>

      {/* Legend Chips (Rule 7) */}
      <div className="legend-row">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--success)' }} />
          SoC &gt; 50%
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--warning)' }} />
          20–50%
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--danger)' }} />
          &lt; 20% (reserve)
        </div>
        {deficitIntervals.length > 0 && (
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'rgba(239,83,80,0.6)', borderRadius: 2 }} />
            Deficit interval
          </div>
        )}
      </div>

      {/* SoC History Chart */}
      {hasData ? (
        <div className="panel-section">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0 }}>Battery State of Charge (SoC) History</h3>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              20% / 50% thresholds are default user-adjustable inputs, not flight requirements
            </span>
          </div>
          <div className="chart-wrapper" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              {/* Added right margin: 60px so threshold labels are not clipped (A.3.5) */}
              <LineChart data={socData} margin={{ top: 10, right: 60, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="t"
                  stroke="var(--text-muted)"
                  tick={{ fontSize: 10 }}
                  tickCount={8}
                  label={{ value: 'Hours', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 10 }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fontSize: 10 }}
                  domain={[0, 1]}
                  tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Reserve threshold lines (insideRight position prevents clipping) */}
                <ReferenceLine
                  y={0.2}
                  stroke="var(--danger)"
                  strokeDasharray="4 2"
                  strokeWidth={1}
                  label={{ value: 'Reserve 20% (adjustable)', fill: 'var(--danger)', fontSize: 9, position: 'insideRight' }}
                />
                <ReferenceLine
                  y={0.5}
                  stroke="var(--warning)"
                  strokeDasharray="4 2"
                  strokeWidth={1}
                  label={{ value: '50% (adjustable)', fill: 'var(--warning)', fontSize: 9, position: 'insideRight' }}
                />

                {/* Deficit shading */}
                {deficitIntervals.map((d, i) => (
                  <ReferenceArea
                    key={i}
                    x1={d.start}
                    x2={d.end}
                    fill="rgba(239, 83, 80, 0.15)"
                    stroke="rgba(239, 83, 80, 0.3)"
                    strokeWidth={1}
                  />
                ))}

                <Line
                  type="monotone"
                  dataKey="soc"
                  name="SoC"
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {socData.length < (siteData?.soc_history?.length ?? 0) && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 6 }}>
              Downsampled to {socData.length} points for display
            </div>
          )}
        </div>
      ) : (
        <div className="panel-section">
          <div className="empty-state" style={{ height: 120 }}>
            <span>No SoC history available for this site</span>
          </div>
        </div>
      )}

      {/* Deficit intervals table */}
      {deficitIntervals.length > 0 && (
        <div className="panel-section">
          <h3 style={{ color: 'var(--danger)' }}>Deficit Intervals ({deficitIntervals.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right' }}>Min SoC</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right' }}>Duration</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right' }}>Censored?</th>
                </tr>
              </thead>
              <tbody>
                {deficitIntervals.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(42,42,74,0.4)' }}>
                    <td style={{ padding: '4px 8px', color: 'var(--danger)' }}>{i + 1}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {d.min_soc_in_interval != null ? `${(d.min_soc_in_interval * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td
                      style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}
                      title={formatHoursTooltip(d.duration_s)}
                    >
                      {formatDuration(d.duration_s)}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '0.68rem', color: d.censored ? 'var(--color-caution)' : 'var(--text-muted)' }}>
                      {d.censored ? (
                        <span className="glossary-term" title={GLOSSARY.censored.definition}>
                          yes (truncated)
                        </span>
                      ) : 'no'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
