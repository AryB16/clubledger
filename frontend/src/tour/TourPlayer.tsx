import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearTourEvent, emitTour } from './events'
import { drawRing, findTarget, placeSpot } from './placement'
import { STEPS } from './steps'
import { Icon } from '../components/icons'

const RETRY_MS = 150
const GIVE_UP_MS = 3000
/** Show the ring anyway if a smooth scroll is interrupted. */
const SCROLL_MAX_MS = 1400

export function TourPlayer({ onFinish, onExit }: { onFinish: () => void; onExit: () => void }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const card = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)
  const pauseButton = useRef<HTMLButtonElement>(null)
  const fills = useRef<(HTMLSpanElement | null)[]>([])
  const navigate = useNavigate()

  const go = useEffectEvent((route: string) => {
    if (window.location.pathname + window.location.search !== route) navigate(route, { replace: true })
  })
  const next = () => (index + 1 < STEPS.length ? setIndex(index + 1) : onFinish())
  const advance = useEffectEvent(next)
  const exit = useEffectEvent(onExit)

  useEffect(() => {
    pauseButton.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const step = STEPS[index]
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    clearTourEvent()
    go(step.route)

    // One loop per step drives the search, the clock, the bar and the ring. Cancelling it clears all four.
    let frame = 0
    let before = performance.now()
    let searched = 0
    let nextTry = 0
    let found = false
    let elapsed = 0
    let fired = false
    let goal = -1
    let scrolledAt = 0
    let arrived = false

    const showRing = (on: boolean) => {
      if (ring.current) ring.current.hidden = !on
      if (dim.current) dim.current.hidden = on
    }
    showRing(false)

    const tick = (now: number) => {
      const delta = Math.min(250, Math.max(0, now - before))
      before = now
      let el: HTMLElement | null = null
      const onRoute = window.location.pathname === step.route

      if (found) {
        el = onRoute ? findTarget(step.target) : null
        if (!el) found = false
      } else {
        searched += pausedRef.current ? 0 : delta
        if (now >= nextTry) {
          nextTry = now + RETRY_MS
          el = onRoute ? findTarget(step.target) : null
          if (el) {
            found = true
            searched = 0
          }
        }
        if (!found && searched >= GIVE_UP_MS) {
          advance()
          return
        }
      }

      if (el && card.current && ring.current) {
        const spot = placeSpot(el, card.current)
        // Follow the feature when data arrives and moves it, but leave the visitor's own scrolling alone.
        if (Math.abs(spot.scrollTo - goal) > 2) {
          goal = spot.scrollTo
          scrolledAt = now
          arrived = false
          window.scrollTo({ top: goal, behavior: still ? 'instant' : 'smooth' })
        }
        arrived ||= Math.abs(window.scrollY - goal) < 4 || now - scrolledAt > SCROLL_MAX_MS
        showRing(arrived && drawRing(ring.current, spot))

        if (!pausedRef.current && arrived) elapsed += delta
        if (step.event && !fired && elapsed >= (step.eventDelay ?? 0)) {
          fired = true
          emitTour(step.event)
        }
        const done = Math.min(1, elapsed / step.ms)
        const fill = fills.current[index]
        // With reduced motion the bar moves in quarters instead of sliding.
        if (fill) fill.style.transform = `scaleX(${still ? Math.floor(done * 4) / 4 : done})`
        if (done >= 1) {
          advance()
          return
        }
      } else if (!found) {
        showRing(false)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      clearTourEvent()
      showRing(false)
    }
  }, [index])

  const togglePause = () => {
    pausedRef.current = !paused
    setPaused(!paused)
  }

  return (
    <div className="tour">
      <div ref={dim} className="tour-dim" data-testid="tour-dim" />
      <div ref={ring} className="tour-ring" data-testid="tour-ring" aria-hidden hidden />
      <div ref={card} role="dialog" aria-label="Guided tour" className="tour-card" data-testid="tour-card" data-step={index + 1}>
        <div className="tour-bars" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.target} className="tour-bar" data-state={i < index ? 'done' : i === index ? 'current' : 'todo'}>
              <span
                ref={(node) => {
                  fills.current[i] = node
                }}
              />
            </span>
          ))}
        </div>
        {/* All captions share one cell, so the card keeps one height and they can crossfade. */}
        <div className="tour-captions" aria-hidden>
          {STEPS.map((s, i) => (
            <p key={s.target} data-active={i === index}>
              {s.caption}
            </p>
          ))}
        </div>
        <p role="status" className="sr-only">
          {STEPS[index].caption}
        </p>
        <div className="tour-controls">
          <span className="tour-count" data-testid="tour-count">
            {index + 1} / {STEPS.length}
          </span>
          <button ref={pauseButton} type="button" className="tour-text" onClick={togglePause}>
            {paused ? 'Play' : 'Pause'}
          </button>
          <button type="button" className="tour-pill" onClick={next}>
            Next
          </button>
          <button type="button" className="tour-close" onClick={onExit} aria-label="Exit tour">
            <Icon name="cross" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
