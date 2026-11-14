import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ReferenceArea, Legend
} from 'recharts'

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
      <div style={{ marginBottom: 4, color: 'var(--text-muted)', fontSize: '0.68rem' }}>t={label}h</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: getSocColor(p.value) }}>
          {p.name}: {(p.value * 100).toFixed(1)}%
        </div>
      ))}
    </div>
  )
}

function formatWh(wh) {
  if (wh == null) return '—'
  if (Math.abs(wh) > 1000) return `${(wh / 1000).toFixed(2)} kWh`
  return `${wh.toFixed(1)} Wh`
}

function formatDuration(s) {
  if (s == null) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function EnergyPanel({ siteData, site }) {
  const energy = siteData?.metrics?.energy || {}

  const { socData, deficitIntervals } = useMemo(() => {
    const ts = siteData?.time_series || {}
    const times = ts.times_et || []
    const socHistory = siteData?.soc_history || ts.soc_history || []
    const deficits = siteData?.deficit_intervals || energy?.deficit_intervals || []

    if (!times.length || !socHistory.length) {
      return { socData: [], deficitIntervals: deficits }
    }

    const n = Math.min(times.length, socHistory.length)
    const refTime = times[0] / 3600

    const step = n > MAX_POINTS ? Math.ceil(n / MAX_POINTS) : 1
    const sampled = []
    for (let i = 0; i < n; i += step) {
      const soc = socHistory[i] ?? 0
      sampled.push({ t: Math.round(times[i] / 3600 - refTime), soc })
    }

    // Normalize deficit intervals to relative hours
    const defNorm = deficits.map(d => ({
      start: Math.round((d.start_et ?? d.start ?? 0) / 3600 - refTime),
      end: Math.round((d.end_et ?? d.end ?? 0) / 3600 - refTime),
    }))

    return { socData: sampled, deficitIntervals: defNorm }
  }, [siteData, energy])

  const socStatus = energy.min_soc != null
    ? energy.min_soc < 0.2 ? 'bad' : energy.min_soc < 0.5 ? 'warn' : 'good'
    : 'neutral'

  const hasData = socData.length > 0

  return (
    <div>
      {/* Energy metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">&#9889; Generated</div>
          <div className="metric-value good">{formatWh(energy.generated_wh)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">&#128267; Consumed</div>
          <div className="metric-value neutral">{formatWh(energy.consumed_wh)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Min SoC</div>
          <div className={`metric-value ${socStatus}`}>
            {energy.min_soc != null ? `${(energy.min_soc * 100).toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Below Reserve</div>
          <div className={`metric-value ${energy.time_below_reserve_s > 0 ? 'bad' : 'good'}`}>
            {formatDuration(energy.time_below_reserve_s)}
          </div>
        </div>
        {energy.net_wh != null && (
          <div className="metric-card">
            <div className="metric-label">Net Energy</div>
            <div className={`metric-value ${energy.net_wh >= 0 ? 'good' : 'bad'}`}>
              {formatWh(energy.net_wh)}
            </div>
          </div>
        )}
        {energy.peak_power_w != null && (
          <div className="metric-card">
            <div className="metric-label">Peak Power</div>
            <div className="metric-value neutral">{energy.peak_power_w?.toFixed(1)} W</div>
          </div>
        )}
        <div className="metric-card">
          <div className="metric-label">Deficit Events</div>
          <div className={`metric-value ${deficitIntervals.length > 0 ? 'bad' : 'good'}`}>
            {deficitIntervals.length}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Site Min SoC</div>
          <div className={`metric-value ${(site?.min_soc ?? 0) < 0.2 ? 'bad' : 'good'}`}>
            {site?.min_soc != null ? `${(site.min_soc * 100).toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>

      {/* SoC chart legend */}
      <div className="legend-row">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--success)' }} />
          SoC &gt; 50%
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--warning)' }} />
          20-50%
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--danger)' }} />
          &lt; 20% (critical)
        </div>
        {deficitIntervals.length > 0 && (
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'rgba(239,83,80,0.3)', borderRadius: 2 }} />
            Deficit interval
          </div>
        )}
      </div>

      {/* SoC History Chart */}
      {hasData ? (
        <div className="panel-section">
          <h3>Battery State of Charge (SoC) History</h3>
          <div className="chart-wrapper" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={socData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="t"
                  stroke="var(--text-muted)"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Hours', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 10 }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fontSize: 10 }}
                  domain={[0, 1]}
                  tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Reserve threshold lines */}
                <ReferenceLine y={0.2} stroke="var(--danger)" strokeDasharray="4 2" strokeWidth={1}
                  label={{ value: 'Reserve 20%', fill: 'var(--danger)', fontSize: 9, position: 'right' }} />
                <ReferenceLine y={0.5} stroke="var(--warning)" strokeDasharray="4 2" strokeWidth={1}
                  label={{ value: '50%', fill: 'var(--warning)', fontSize: 9, position: 'right' }} />

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
                  <th style={{ padding: '5px 8px', textAlign: 'right' }}>Start (h)</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right' }}>End (h)</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {deficitIntervals.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(42,42,74,0.4)' }}>
                    <td style={{ padding: '4px 8px', color: 'var(--danger)' }}>{i + 1}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{d.start}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{d.end}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--warning)' }}>
                      {d.end - d.start}h
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
