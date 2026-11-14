import { useState, useEffect } from 'react'

function Chip({ label, value, mono = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      background: '#0d0d22', borderRadius: 6, padding: '6px 10px',
      border: '1px solid #222244', marginBottom: 4,
    }}>
      <span style={{ color: '#8888aa', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ color: '#e0e0f0', fontSize: '0.78rem', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

export default function ProvenanceBadge({ siteData, site }) {
  const [agreement, setAgreement] = useState(null)

  useEffect(() => {
    fetch('/data/agreement_benchmark.json')
      .then(r => r.json())
      .then(setAgreement)
      .catch(() => {})
  }, [])

  if (!siteData) return <div className="empty-state"><span>No data loaded</span></div>

  const prov = siteData.provenance ?? {}
  const { kernels = [], assumptions = [], limitations = [], result_sha256, run_id, computed_at } = prov

  return (
    <div style={{ padding: '12px 16px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Left column */}
        <div>
          <h3 style={{ color: 'var(--accent)', fontSize: '0.8rem', margin: '0 0 8px' }}>🔐 Run Identity</h3>
          <Chip label="Run ID" value={run_id} mono />
          <Chip label="Computed At" value={computed_at ?? 'N/A'} />
          <Chip label="SHA-256" value={result_sha256 ? `${result_sha256.slice(0, 20)}…${result_sha256.slice(-8)}` : 'N/A'} mono />

          <h3 style={{ color: 'var(--accent)', fontSize: '0.8rem', margin: '12px 0 8px' }}>📡 SPICE Kernels</h3>
          {kernels.map((k, i) => (
            <div key={i} style={{
              background: '#0d0d22', borderRadius: 4, padding: '5px 8px', marginBottom: 4,
              fontSize: '0.7rem', fontFamily: 'monospace', color: '#a0c4ff',
              border: '1px solid #1a1a3a'
            }}>
              {typeof k === 'string' ? k : k.name ?? JSON.stringify(k)}
            </div>
          ))}

          {/* Agreement badge */}
          {agreement && (
            <>
              <h3 style={{ color: 'var(--accent)', fontSize: '0.8rem', margin: '12px 0 8px' }}>🔬 Visual/Science Agreement</h3>
              <div style={{
                background: agreement.agreement_pass ? '#0d2a0d' : '#2a0d0d',
                border: `1px solid ${agreement.agreement_pass ? '#22c55e' : '#ef4444'}`,
                borderRadius: 6, padding: '8px 12px', fontSize: '0.75rem'
              }}>
                <div style={{ color: '#a0ffa0' }}>IoU: <strong>{agreement.iou?.toFixed(4)}</strong> (threshold ≥ 0.90)</div>
                <div style={{ color: '#a0ffa0' }}>Discrepancy: <strong>{agreement.discrepancy_deg}°</strong></div>
                <div style={{ marginTop: 4, color: agreement.agreement_pass ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                  {agreement.agreement_pass ? '✅ PASS' : '❌ FAIL'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div>
          <h3 style={{ color: 'var(--accent)', fontSize: '0.8rem', margin: '0 0 8px' }}>⚠️ Limitations</h3>
          {limitations.length === 0
            ? <p style={{ color: '#8888aa', fontSize: '0.72rem' }}>None listed.</p>
            : limitations.map((l, i) => (
              <div key={i} style={{
                display: 'flex', gap: 6, marginBottom: 6,
                fontSize: '0.72rem', color: '#ffcc80', alignItems: 'flex-start'
              }}>
                <span style={{ marginTop: 1 }}>⚠</span>
                <span>{l}</span>
              </div>
            ))}

          <h3 style={{ color: 'var(--accent)', fontSize: '0.8rem', margin: '12px 0 8px' }}>📌 Assumptions</h3>
          {assumptions.length === 0
            ? <p style={{ color: '#8888aa', fontSize: '0.72rem' }}>None listed.</p>
            : assumptions.map((a, i) => (
              <div key={i} style={{
                display: 'flex', gap: 6, marginBottom: 6,
                fontSize: '0.72rem', color: '#c0c0e0', alignItems: 'flex-start'
              }}>
                <span style={{ marginTop: 1 }}>→</span>
                <span>{a}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
