import { useEffect, useEffectEvent, useRef } from 'react'

export function TourOffer({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <aside className="tour tour-card tour-offer" aria-label="Tour offer" data-testid="tour-offer">
      <p>New here? See how it works in a minute.</p>
      <div className="tour-controls">
        <button type="button" className="tour-pill" onClick={onStart}>
          Take a tour
        </button>
        <button type="button" className="tour-text" onClick={onSkip}>
          Skip
        </button>
      </div>
    </aside>
  )
}

export function TourEnd({ onClose, onAgain }: { onClose: () => void; onAgain: () => void }) {
  const first = useRef<HTMLButtonElement>(null)
  const close = useEffectEvent(onClose)
  useEffect(() => {
    first.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="tour tour-end" data-testid="tour-end">
      <div role="dialog" aria-modal="true" aria-labelledby="tour-end-h" className="tour-end-card">
        <h2 id="tour-end-h">You're all set</h2>
        <p>Check any receipt, follow the balance and see proof of every rule.</p>
        <div className="tour-end-actions">
          <button ref={first} type="button" className="tour-pill" onClick={onClose}>
            Start using it
          </button>
          <button type="button" className="tour-text" onClick={onAgain}>
            Watch again
          </button>
        </div>
      </div>
    </div>
  )
}
