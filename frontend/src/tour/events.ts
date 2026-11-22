import { useContext, useEffect, useEffectEvent } from 'react'
import { TourPage } from './context'
import type { TourAction } from './steps'

const EVENT = 'clubledger:tour'
const HOLD_MS = 5000

// The latest event, kept for a page that is still mounting when it fires.
let held: { name: TourAction; at: number } | null = null

export function emitTour(name: TourAction) {
  held = { name, at: Date.now() }
  window.dispatchEvent(new CustomEvent<TourAction>(EVENT, { detail: name }))
}

export function clearTourEvent() {
  held = null
}

/** Runs `action` on the tour's copy of a page. The visitor's copy never reacts. Return a function to clear timers. */
export function useTourEvent(name: TourAction, action: () => (() => void) | void) {
  const inTour = useContext(TourPage)
  const act = useEffectEvent(action)
  useEffect(() => {
    if (!inTour) return
    let undo: (() => void) | void
    const run = () => {
      undo?.()
      undo = act()
    }
    const onEvent = (e: Event) => {
      if ((e as CustomEvent<TourAction>).detail === name) run()
    }
    window.addEventListener(EVENT, onEvent)
    if (held?.name === name && Date.now() - held.at < HOLD_MS) run()
    return () => {
      window.removeEventListener(EVENT, onEvent)
      undo?.()
    }
  }, [inTour, name])
}
