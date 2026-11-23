import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearTourEvent, emitTour } from './events'
import { findTarget, placeSpot, ringBox, type Box } from './placement'
import { STEPS } from './steps'
import { Icon } from '../components/icons'

const RETRY_MS = 150
const GIVE_UP_MS = 3000
/** Start the clock anyway if a scroll is interrupted. */
const SCROLL_MAX_MS = 1600
/** Fade the old page out before changing it, and show the new one after this long even if its feature is late. */
const LEAVE_MS = 220
const REVEAL_MAX_MS = 900
/** The pointer's trip to a button, and the pause after its press before anything happens. */
export const TRAVEL_MS = 950
export const PRESS_MS = 450
/** How quickly the ring settles on a new feature. Larger is slower. */
const GLIDE_MS = 120

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function TourPlayer({ onFinish, onExit }: { onFinish: () => void; onExit: () => void }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const card = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)
  const pointer = useRef<HTMLDivElement>(null)
  const pauseButton = useRef<HTMLButtonElement>(null)
  const fills = useRef<(HTMLSpanElement | null)[]>([])
  /** Where the ring is drawn, in page coordinates, carried from step to step so it can glide. */
  const drawn = useRef<(Box & { alpha: number }) | null>(null)
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
    return () => {
      document.removeEventListener('keydown', onKey)
      document.querySelector('[data-tour-page]')?.classList.remove('tour-away')
    }
  }, [])

  useEffect(() => {
    const step = STEPS[index]
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const page = document.querySelector<HTMLElement>('[data-tour-page]')
    clearTourEvent()

    // A step on another page fades this one out, swaps it while unseen, and fades the new one in already in place.
    const crossing = window.location.pathname !== step.route
    let leftAt = crossing && !still && page ? performance.now() : -1
    if (leftAt >= 0) page!.classList.add('tour-away')
    else {
      go(step.route)
      page?.classList.remove('tour-away')
    }
    let navAt = leftAt >= 0 ? -1 : performance.now()
    let revealed = leftAt < 0

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
    let tween: { from: number; to: number; start: number; ms: number } | null = null
    let snap = !drawn.current || drawn.current.alpha < 0.05
    // The pointer: where it set off from, and how far along its job it is.
    let from: { x: number; y: number } | null = null
    let pressed: HTMLElement | null = null
    let acted = false

    // A visitor's own wheel or swipe wins over the tour's scroll.
    const yieldScroll = () => {
      if (!tween) return
      tween = null
      arrived = true
    }
    window.addEventListener('wheel', yieldScroll, { passive: true })
    window.addEventListener('touchstart', yieldScroll, { passive: true })

    const paint = (target: Box | null, dt: number) => {
      const r = ring.current
      if (!r) return
      const y = window.scrollY
      let d = drawn.current
      if (target) {
        const want = { ...target, top: target.top + y }
        if (!d || snap || still) d = { ...want, alpha: d && !snap ? d.alpha : 0 }
        else {
          const k = 1 - Math.exp(-dt / GLIDE_MS)
          d = {
            top: d.top + (want.top - d.top) * k,
            left: d.left + (want.left - d.left) * k,
            width: d.width + (want.width - d.width) * k,
            height: d.height + (want.height - d.height) * k,
            radius: d.radius + (want.radius - d.radius) * k,
            alpha: d.alpha,
          }
        }
        snap = false
      }
      if (d) {
        const k = still ? 1 : 1 - Math.exp(-dt / 90)
        d.alpha += ((target ? 1 : 0) - d.alpha) * k
        if (d.alpha < 0.01) d.alpha = 0
        if (d.alpha > 0.99) d.alpha = 1
      }
      drawn.current = d
      const alpha = d?.alpha ?? 0
      r.hidden = alpha === 0
      if (d && alpha > 0) {
        Object.assign(r.style, {
          transform: `translate(${d.left}px, ${d.top - y}px)`,
          width: `${d.width}px`,
          height: `${d.height}px`,
          borderRadius: `${d.radius}px`,
          opacity: String(alpha),
        })
      }
      // The ring's own shadow dims the page around it. The plain dim makes up the rest, so the room never flickers.
      if (dim.current) dim.current.style.opacity = String(1 - alpha)
    }

    const release = () => {
      pressed?.removeAttribute('data-tour-pressed')
      pressed = null
    }
    const hidePointer = () => {
      if (pointer.current) pointer.current.hidden = true
    }
    hidePointer()

    const movePointer = () => {
      const c = step.cursor
      const p = pointer.current
      if (!c || !p) return
      const t = (elapsed - c.at) / TRAVEL_MS
      const button = document.querySelector<HTMLElement>(`[data-tour-page] [data-tour-click="${c.target}"]`)
      if (t < 0 || !button) return hidePointer()
      const b = button.getBoundingClientRect()
      const to = { x: b.left + b.width * 0.55, y: b.top + b.height * 0.62 }
      const { clientWidth: w, clientHeight: h } = document.documentElement
      from ??= { x: clamp(to.x + 140, 12, w - 36), y: clamp(to.y + 110, 12, h - 36) }
      const e = still ? 1 : easeInOut(Math.min(1, t))
      // A slight arc, the way a hand moves a mouse.
      const arc = Math.sin(Math.PI * e) * 26
      const x = from.x + (to.x - from.x) * e + arc * 0.4
      const y = from.y + (to.y - from.y) * e - arc
      p.hidden = false
      p.style.transform = `translate(${x}px, ${y}px)`
      p.style.opacity = String(still ? 1 : Math.min(1, t * 5))
      if (t < 1 || !c.then) return
      if (!pressed && !acted) {
        pressed = button
        button.setAttribute('data-tour-pressed', '')
        p.classList.remove('tour-press')
        void p.offsetWidth // restart the ripple
        p.classList.add('tour-press')
      }
      if (elapsed >= c.at + TRAVEL_MS + 180) release()
      if (!acted && elapsed >= c.at + TRAVEL_MS + PRESS_MS) {
        acted = true
        if (c.then === 'advance') return 'advance'
        emitTour(c.then)
      }
    }

    const tick = (now: number) => {
      const delta = Math.min(250, Math.max(0, now - before))
      before = now

      if (navAt < 0) {
        paint(null, delta)
        if (now - leftAt >= LEAVE_MS) {
          navAt = now
          leftAt = -1
          go(step.route)
        }
        frame = requestAnimationFrame(tick)
        return
      }

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

      if (!revealed && (el || now - navAt > REVEAL_MAX_MS)) {
        revealed = true
        page?.classList.remove('tour-away')
        snap = true
        // Arrive already in place: the new page fades in at its feature instead of scrolling there.
        if (el && card.current) {
          goal = placeSpot(el, card.current).scrollTo
          window.scrollTo({ top: goal, behavior: 'instant' })
          arrived = true
        }
      }

      if (el && card.current && ring.current && revealed) {
        const spot = placeSpot(el, card.current)
        // Follow the feature when data arrives and moves it, but leave the visitor's own scrolling alone.
        if (Math.abs(spot.scrollTo - goal) > 2) {
          goal = spot.scrollTo
          scrolledAt = now
          arrived = false
          const dist = Math.abs(goal - window.scrollY)
          if (still || dist < 4) window.scrollTo({ top: goal, behavior: 'instant' })
          else tween = { from: window.scrollY, to: goal, start: now, ms: clamp(420 + dist * 0.45, 560, 1150) }
        }
        if (tween) {
          const p = Math.min(1, (now - tween.start) / tween.ms)
          window.scrollTo({ top: tween.from + (tween.to - tween.from) * easeInOut(p), behavior: 'instant' })
          if (p >= 1) tween = null
        }
        arrived ||= (!tween && Math.abs(window.scrollY - goal) < 4) || now - scrolledAt > SCROLL_MAX_MS
        paint(ringBox(spot), delta)

        if (!pausedRef.current && arrived) elapsed += delta
        if (step.event && !fired && elapsed >= (step.eventDelay ?? 0)) {
          fired = true
          emitTour(step.event)
        }
        if (arrived && movePointer() === 'advance') {
          advance()
          return
        }
        const done = Math.min(1, elapsed / step.ms)
        const fill = fills.current[index]
        // With reduced motion the bar moves in quarters instead of sliding.
        if (fill) fill.style.transform = `scaleX(${still ? Math.floor(done * 4) / 4 : done})`
        if (done >= 1) {
          advance()
          return
        }
      } else {
        paint(null, delta)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('wheel', yieldScroll)
      window.removeEventListener('touchstart', yieldScroll)
      clearTourEvent()
      release()
      hidePointer()
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
      <div ref={pointer} className="tour-pointer" data-testid="tour-pointer" aria-hidden hidden>
        <span className="tour-ripple" />
        <svg viewBox="0 0 24 24" width="26" height="26">
          <path d="M4 2.5v17.2l4.6-4.3 2.9 6.6 3.1-1.4-2.9-6.5H18z" fill="#fff" stroke="#0e1a24" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
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
