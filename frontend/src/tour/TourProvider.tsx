import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, type Location } from 'react-router-dom'
import { readVersions } from '../lib/ledger'
import { TourContext, type Tour } from './context'
import { TourEnd, TourOffer } from './TourCards'
import { TourPlayer } from './TourPlayer'
import { EXAMPLE_CODE } from './steps'
import './tour.css'

const CHOICE_KEY = 'clubledger.tour'

function readChoice() {
  try {
    return localStorage.getItem(CHOICE_KEY)
  } catch {
    return null // storage blocked: the tour still works, the offer just returns next visit
  }
}

function saveChoice(choice: 'taken' | 'skipped') {
  try {
    localStorage.setItem(CHOICE_KEY, choice)
  } catch {
    // storage blocked
  }
}

interface Saved {
  location: Location
  scroll: number
  title: string
}

const pathOf = (l: { pathname: string; search: string; hash: string }) => l.pathname + l.search + l.hash

export function TourProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const queries = useQueryClient()
  const [saved, setSaved] = useState<Saved | null>(null)
  // Leaving takes two renders: go back to the visitor's URL, then uncover their page.
  const [leaving, setLeaving] = useState<'done' | 'exit' | null>(null)
  const [ended, setEnded] = useState(false)
  const [offer, setOffer] = useState(() => !readChoice())
  const [restored, setRestored] = useState<(Saved & { refocus: boolean }) | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  const start = () => {
    if (saved) return
    if (!ended) returnFocus.current = document.activeElement as HTMLElement | null
    saveChoice('taken')
    setOffer(false)
    setEnded(false)
    setRestored(null)
    setSaved({ location, scroll: window.scrollY, title: document.title })
    // Read ahead, so the receipt step isn't spent waiting.
    void queries.prefetchQuery({ queryKey: ['versions', EXAMPLE_CODE], queryFn: () => readVersions(EXAMPLE_CODE) })
  }

  const leave = (how: 'done' | 'exit') => {
    if (!saved || leaving) return
    setLeaving(how)
    if (pathOf(window.location) !== pathOf(saved.location)) navigate(saved.location, { replace: true, state: saved.location.state })
  }

  // Uncovering before the URL is back would remount the visitor's page and lose what they typed.
  if (saved && leaving && pathOf(location) === pathOf(saved.location)) {
    setRestored({ ...saved, refocus: leaving === 'exit' })
    setEnded(leaving === 'done')
    setSaved(null)
    setLeaving(null)
  }

  useEffect(() => {
    if (!restored) return
    document.title = restored.title
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: restored.scroll, behavior: 'instant' })
      if (restored.refocus) returnFocus.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [restored])

  // Back or forward during the tour means the visitor has moved on.
  const busy = !!saved || ended
  useEffect(() => {
    if (!busy) return
    const onPop = () => {
      setSaved(null)
      setLeaving(null)
      setEnded(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [busy])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('tour-open', !!saved)
    root.classList.toggle('tour-offered', offer && !saved)
    return () => root.classList.remove('tour-open', 'tour-offered')
  }, [saved, offer])

  const close = () => {
    setEnded(false)
    requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true }))
  }

  const tour: Tour = {
    start,
    stop: () => (saved ? leave('exit') : close()),
    running: !!saved,
    origin: saved?.location ?? null,
    blocking: busy,
  }

  return (
    <TourContext value={tour}>
      {children}
      {saved && !leaving && <TourPlayer onFinish={() => leave('done')} onExit={() => leave('exit')} />}
      {ended && <TourEnd onClose={close} onAgain={start} />}
      {offer && !busy && (
        <TourOffer
          onStart={start}
          onSkip={() => {
            saveChoice('skipped')
            setOffer(false)
          }}
        />
      )}
    </TourContext>
  )
}
