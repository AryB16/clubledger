import { createContext, useContext } from 'react'
import type { Location } from 'react-router-dom'

export interface Tour {
  start: () => void
  stop: () => void
  running: boolean
  /** The visitor's own page while the tour runs. It stays mounted, hidden, so nothing they typed is lost. */
  origin: Location | null
  /** True while the page behind must ignore clicks and keys: during the tour and on the end card. */
  blocking: boolean
}

export const TourContext = createContext<Tour | null>(null)

export function useTour() {
  const tour = useContext(TourContext)
  if (!tour) throw new Error('useTour needs a TourProvider')
  return tour
}

/** True inside the tour's own copy of the page. Only that copy acts on tour events. */
export const TourPage = createContext(false)
