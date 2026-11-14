import { useState, useCallback } from 'react'

export default function MissionPlannerHeadline({ site, siteData }) {
  const [copied, setCopied] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const mSun = siteData?.metrics?.sunlight || {}
  const mEarth = siteData?.metrics?.geometric_earth_visibility || {}

  const sunPct = ((site.sunlight_fraction ?? 0) * 100).toFixed(1)
  const sunHours = ((mSun.total_sunlight_s ?? 0) / 3600).toFixed(0)
  const earthPct = ((site.geometric_earth_visibility_fraction ?? 0) * 100).toFixed(1)
  const earthHours = ((mEarth.total_visibility_s ?? 0) / 3600).toFixed(0)
  const maxNight = ((mSun.longest_dark_run_s ?? 0) / 3600).toFixed(1)
  const maxBlackout = ((mEarth.longest_earth_blackout_s ?? 0) / 3600).toFixed(1)

  const isCriticalBatteryRisk = (mSun.longest_dark_run_s ?? 0) > 432000 // > 120h
  const isFarSide = site.lon_deg > 90 || site.lon_deg < -90

  // Plain English executive briefing
  const briefingText = isFarSide
    ? `Mission Briefing for ${site.name}: Over this 29.5-day synodic cycle, the Sun is above the horizon for ${sunPct}% of the time (${sunHours} hours), with a maximum continuous night of ${maxNight} hours. Direct-to-Earth communication is permanently zero percent due to lunar far-side occultation, requiring an orbital relay satellite at the L2 Lagrangian point.`
    : `Mission Briefing for ${site.name}: Over this 29.5-day synodic cycle, the Sun is up ${sunPct}% of the time (${sunHours} hours) and Earth is in line-of-sight ${earthPct}% of the time (${earthHours} hours). The longest continuous night is ${maxNight} hours${isCriticalBatteryRisk ? ' which exceeds the 120-hour battery reserve threshold' : ''}, and the maximum comms blackout is ${maxBlackout} hours.`

  // Text-to-Speech audio reader
  const handleSpeak = useCallback(() => {
    if (!('speechSynthesis' in window)) return

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(briefingText)
    utterance.rate = 1.05
    utterance.pitch = 1.0
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }, [briefingText, isSpeaking])

  // Copy to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(briefingText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }, [briefingText])

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(15, 23, 42, 0.75) 100%)',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      borderRadius: '10px',
      padding: '14px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    }}>
      {/* Header Tag with Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.9rem' }}>⏱️</span>
          <span style={{
            fontFamily: 'var(--font-label)',
            fontSize: '0.64rem',
            color: '#38bdf8',
            letterSpacing: '0.08em',
            fontWeight: 700
          }}>
            10-SECOND MISSION PLANNER BRIEFING
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.58rem',
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#4ade80',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '4px',
            padding: '1px 6px'
          }}>
            NASA SPICE VERIFIED
          </span>
        </div>

        {/* Action Buttons: Audio Listen + Copy */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {'speechSynthesis' in window && (
            <button
              onClick={handleSpeak}
              title="Listen to synthesized mission director briefing"
              style={{
                fontFamily: 'var(--font-ui)',
                background: isSpeaking ? '#ef4444' : 'rgba(56, 189, 248, 0.15)',
                color: isSpeaking ? '#fff' : '#38bdf8',
                border: `1px solid ${isSpeaking ? '#ef4444' : 'rgba(56, 189, 248, 0.4)'}`,
                borderRadius: '5px',
                padding: '3px 9px',
                fontSize: '0.66rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>{isSpeaking ? '⏹ Stop' : '🔊 Listen'}</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            title="Copy mission briefing to clipboard"
            style={{
              fontFamily: 'var(--font-ui)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: copied ? '#34d399' : '#cbd5e1',
              border: `1px solid ${copied ? 'rgba(52, 211, 153, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '5px',
              padding: '3px 9px',
              fontSize: '0.66rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {copied ? '✓ Copied' : '📋 Copy Briefing'}
          </button>
        </div>
      </div>

      {/* The 10-Second Plain English Assessment Headline */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.94rem',
        fontWeight: 600,
        color: '#f8fafc',
        lineHeight: 1.5
      }}>
        Over this 29.5-day synodic cycle, the Sun is up{' '}
        <strong style={{ color: '#fbbf24', textDecoration: 'underline' }}>{sunPct}%</strong> ({sunHours} h) and Earth is in view{' '}
        <strong style={{ color: '#38bdf8', textDecoration: 'underline' }}>{earthPct}%</strong> ({earthHours} h); the longest continuous night is{' '}
        <strong style={{ color: isCriticalBatteryRisk ? '#f87171' : '#34d399' }}>{maxNight} h</strong>
        {isCriticalBatteryRisk && <span style={{ color: '#f87171', fontSize: '0.8rem' }}> (⚠️ exceeds 120h battery limit)</span>}
        {' '}and longest comms blackout is{' '}
        <strong style={{ color: Number(maxBlackout) > 200 ? '#f87171' : '#38bdf8' }}>{maxBlackout} h</strong>.
      </div>
    </div>
  )
}
