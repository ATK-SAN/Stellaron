/** QuickTour.jsx — 30-second flight-ops dashboard controls tutorial
 *
 * Rules:
 * - Spotlights one real element at a time with a dimmed overlay cut-out.
 * - Non-blocking first-visit prompt in bottom-right corner.
 * - Replayable anytime via header '?' icon or '?' keyboard shortcut.
 * - Zero side effects on app state (does not select sites, change tabs, or toggle layers).
 * - Full keyboard navigation (ArrowRight, ArrowLeft, Escape, Enter, ?).
 * - Screen reader announcements via aria-live="polite".
 * - Graceful fallback when target element is hidden/missing.
 * - Safe localStorage usage wrapped in try/catch.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Compass,
  Search,
  Layers,
  Tag,
  Gauge,
  Sliders,
  CircleHelp,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
} from 'lucide-react'
import { TOUR_PROMPT, TOUR_STEPS, TOUR_HINTS } from '../copy/tour'
import styles from './QuickTour.module.css'

const ICON_MAP = {
  Compass,
  Search,
  Layers,
  Tag,
  Gauge,
  Sliders,
}

export default function QuickTour({ isOpen, onClose, onOpen }) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState(null)
  const [cardCoords, setCardCoords] = useState({ top: 100, left: 100 })
  const previousFocusRef = useRef(null)
  const cardRef = useRef(null)

  // 1. First visit prompt check (safe localStorage)
  useEffect(() => {
    try {
      const seen = localStorage.getItem('stellaron_tour_seen')
      if (!seen && !isOpen) {
        setShowPrompt(true)
      }
    } catch {
      // If localStorage is unavailable, show prompt safely
      setShowPrompt(true)
    }
  }, [isOpen])

  const dismissPrompt = useCallback((startTour = false) => {
    setShowPrompt(false)
    try {
      localStorage.setItem('stellaron_tour_seen', 'true')
    } catch {}
    if (startTour && onOpen) {
      onOpen()
    }
  }, [onOpen])

  // 2. Filter steps to only those with existing visible DOM targets
  const visibleSteps = useMemo(() => {
    if (typeof document === 'undefined') return TOUR_STEPS
    return TOUR_STEPS.filter(step => {
      const el = document.querySelector(step.target)
      if (!el) return false
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
  }, [isOpen, activeStepIndex])

  const currentStep = visibleSteps[activeStepIndex] || visibleSteps[0]
  const isFirst = activeStepIndex === 0
  const isLast = activeStepIndex === Math.max(0, visibleSteps.length - 1)

  // 3. Position the spotlight and card over active target
  const updatePositions = useCallback(() => {
    if (!isOpen || !currentStep) return
    const el = document.querySelector(currentStep.target)
    if (!el) {
      setSpotlightRect(null)
      return
    }

    const rect = el.getBoundingClientRect()
    const pad = 6
    const spot = {
      top: Math.max(0, rect.top - pad),
      left: Math.max(0, rect.left - pad),
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    }
    setSpotlightRect(spot)

    // Calculate smart card placement
    const cardWidth = 360
    const cardHeight = 240
    const margin = 16
    let top = 0
    let left = 0

    if (currentStep.placement === 'right') {
      left = spot.left + spot.width + margin
      top = spot.top + (spot.height / 2) - 80
      if (left + cardWidth > window.innerWidth - margin) {
        // Fallback to left or bottom if right edge overflows
        left = Math.max(margin, spot.left - cardWidth - margin)
      }
    } else if (currentStep.placement === 'left') {
      left = spot.left - cardWidth - margin
      top = spot.top + (spot.height / 2) - 80
      if (left < margin) {
        left = Math.min(window.innerWidth - cardWidth - margin, spot.left + spot.width + margin)
      }
    } else if (currentStep.placement === 'bottom') {
      top = spot.top + spot.height + margin
      left = Math.max(margin, Math.min(spot.left, window.innerWidth - cardWidth - margin))
    } else {
      top = Math.max(margin, spot.top - cardHeight - margin)
      left = Math.max(margin, Math.min(spot.left, window.innerWidth - cardWidth - margin))
    }

    // Viewport boundary clamps
    top = Math.max(margin, Math.min(top, window.innerHeight - cardHeight - margin))
    left = Math.max(margin, Math.min(left, window.innerWidth - cardWidth - margin))

    setCardCoords({ top, left })
  }, [isOpen, currentStep])

  useEffect(() => {
    updatePositions()
    window.addEventListener('resize', updatePositions)
    window.addEventListener('scroll', updatePositions, true)
    return () => {
      window.removeEventListener('resize', updatePositions)
      window.removeEventListener('scroll', updatePositions, true)
    }
  }, [updatePositions])

  // 4. Focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement
      // Move focus into the card for accessibility
      setTimeout(() => {
        const nextBtn = cardRef.current?.querySelector('button[data-tour-action="next"]')
        nextBtn?.focus()
      }, 50)
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus?.()
    }
  }, [isOpen])

  // 5. Global Keyboard Shortcuts: Arrows, Esc, ?
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)

      // Replay tour on '?' key when not typing in an input
      if ((e.key === '?' || (e.key === '/' && e.shiftKey)) && !isInput) {
        e.preventDefault()
        if (isOpen) {
          onClose()
        } else if (onOpen) {
          setActiveStepIndex(0)
          onOpen()
        }
        return
      }

      if (!isOpen) return

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (!isLast) {
          setActiveStepIndex(prev => Math.min(prev + 1, visibleSteps.length - 1))
        } else {
          onClose()
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (!isFirst) {
          setActiveStepIndex(prev => Math.max(prev - 1, 0))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isFirst, isLast, visibleSteps.length, onClose, onOpen])

  const handleNext = () => {
    if (isLast) {
      onClose()
    } else {
      setActiveStepIndex(prev => Math.min(prev + 1, visibleSteps.length - 1))
    }
  }

  const handleBack = () => {
    setActiveStepIndex(prev => Math.max(prev - 1, 0))
  }

  const StepIcon = (currentStep && ICON_MAP[currentStep.icon]) || Compass

  return (
    <>
      {/* ── First-Visit Non-Blocking Prompt Card ── */}
      {showPrompt && !isOpen && (
        <aside className={styles.promptCard} role="status" aria-label="Quick tour prompt">
          <div className={styles.promptHeader}>
            <CircleHelp size={16} strokeWidth={2} />
            <span>{TOUR_PROMPT.title}</span>
          </div>
          <p className={styles.promptText}>{TOUR_PROMPT.text}</p>
          <div className={styles.promptActions}>
            <button onClick={() => dismissPrompt(false)} className={styles.btnGhost}>
              {TOUR_PROMPT.skipLabel}
            </button>
            <button onClick={() => dismissPrompt(true)} className={styles.btnPrimary}>
              {TOUR_PROMPT.startLabel}
              <ArrowRight size={13} strokeWidth={2} />
            </button>
          </div>
        </aside>
      )}

      {/* ── Fullscreen Dimmed Spotlight Tour ── */}
      {isOpen && currentStep && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            // Clicking dimmed background closes tour
            if (e.target === e.currentTarget) onClose()
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard quick tour"
        >
          {/* Screen reader announcement */}
          <div aria-live="polite" className={styles.srOnly}>
            {`Step ${activeStepIndex + 1} of ${visibleSteps.length}: ${currentStep.name}. ${currentStep.sentence}`}
          </div>

          {/* Transparent Cut-out Box */}
          {spotlightRect && (
            <div
              className={styles.spotlight}
              style={{
                top: `${spotlightRect.top}px`,
                left: `${spotlightRect.left}px`,
                width: `${spotlightRect.width}px`,
                height: `${spotlightRect.height}px`,
              }}
            />
          )}

          {/* Tour Step Card */}
          <div
            ref={cardRef}
            className={styles.card}
            style={{
              top: `${cardCoords.top}px`,
              left: `${cardCoords.left}px`,
            }}
          >
            {/* Header: Icon, Step Name, Counter */}
            <div className={styles.cardHeader}>
              <div className={styles.titleArea}>
                <div className={styles.stepIcon}>
                  <StepIcon size={16} strokeWidth={2} />
                </div>
                <h3 className={styles.stepName}>{currentStep.name}</h3>
              </div>
              <span className={styles.stepCounter}>
                {activeStepIndex + 1} of {visibleSteps.length}
              </span>
            </div>

            {/* Step Sentence (strictly <= 15 words) */}
            <p className={styles.stepSentence}>{currentStep.sentence}</p>

            {/* Sub-items list (if present) */}
            {currentStep.items && currentStep.items.length > 0 && (
              <ul className={styles.itemList}>
                {currentStep.items.map((it, idx) => (
                  <li key={idx} className={styles.itemRow}>
                    <span className={it.name ? styles.itemName : ''}>{it.name}:</span>
                    <span className={styles.itemDesc}>{it.desc}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Final Step Replay Hint */}
            {isLast && (
              <div className={styles.hintText}>
                {TOUR_HINTS.finalHint}
              </div>
            )}

            {/* Footer Navigation Controls */}
            <div className={styles.cardFooter}>
              <button onClick={onClose} className={styles.btnText} aria-label="Skip remaining tour">
                {TOUR_HINTS.skip}
              </button>
              <div className={styles.navGroup}>
                {!isFirst && (
                  <button onClick={handleBack} className={styles.btnGhost} aria-label="Go to previous step">
                    <ArrowLeft size={12} strokeWidth={2} />
                    {TOUR_HINTS.back}
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className={styles.btnPrimary}
                  data-tour-action="next"
                  aria-label={isLast ? 'Complete tour' : 'Go to next step'}
                >
                  <span>{isLast ? TOUR_HINTS.done : TOUR_HINTS.next}</span>
                  {isLast ? <Check size={13} strokeWidth={2} /> : <ArrowRight size={13} strokeWidth={2} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
