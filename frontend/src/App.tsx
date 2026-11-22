import { useLayoutEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation, type Location } from 'react-router-dom'
import Home from './pages/Home'
import Check from './pages/Check'
import Ledger from './pages/Ledger'
import Manage from './pages/Manage'
import { PageHead } from './components/ui'
import { Icon } from './components/icons'
import { TourPage, useTour } from './tour/context'

const nav = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-1 text-[0.8125rem] font-medium transition-colors min-[420px]:px-3 min-[420px]:text-sm sm:px-4 ${
    isActive ? 'bg-white/15 text-white' : 'text-navy-200 hover:text-white'
  }`

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex min-h-11 shrink-0 items-center gap-2 font-display text-lg font-bold text-white max-[419px]:gap-1.5 sm:text-xl">
      <img src="/favicon.svg" alt="" width="30" height="30" className={compact ? 'h-7.5 w-7.5 max-[419px]:h-6.5 max-[419px]:w-6.5' : 'h-7.5 w-7.5'} />
      <span className={compact ? 'max-[369px]:sr-only max-[419px]:text-[0.9375rem]' : undefined}>ClubLedger</span>
    </Link>
  )
}

/** The router keeps the scroll position by default, which hid the verdict after tapping an entry. */
function ScrollToTop() {
  const { pathname } = useLocation()
  // Braces matter: newer Chrome returns a Promise from scrollTo, which React would call as a cleanup.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <>
      <PageHead title="Page not found" />
      <div className="wrap py-10">
        <Link to="/" className="btn btn-dark">
          Go to the home page
        </Link>
      </div>
    </>
  )
}

function TourButton() {
  const { start } = useTour()
  return (
    <button
      type="button"
      onClick={start}
      className="ml-1 inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-white/25 px-2 text-[0.8125rem] font-medium text-white transition-colors hover:bg-white/15 min-[420px]:px-3 min-[420px]:text-sm"
    >
      <Icon name="play" className="h-3 w-3 fill-current" />
      Tour
    </button>
  )
}

function Pages({ location }: { location: Location }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<Home />} />
      <Route path="/check/:code" element={<Check />} />
      <Route path="/ledger" element={<Ledger />} />
      <Route path="/manage" element={<Manage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  const location = useLocation()
  const { running, origin, blocking } = useTour()
  return (
    <div className="min-h-dvh" inert={blocking}>
      <ScrollToTop />
      <header className="on-dark bg-navy-950">
        <div className="wrap flex items-center justify-between gap-2 py-3">
          <Brand compact />
          <nav aria-label="Main" className="flex items-center sm:gap-1">
            <NavLink to="/ledger" className={nav}>
              All entries
            </NavLink>
            <NavLink to="/manage" className={nav}>
              Treasurers
            </NavLink>
            <TourButton />
          </nav>
        </div>
      </header>
      {/* A full screen tall, so the footer never jumps while the record loads. */}
      <main className="page min-h-dvh">
        {/* The tour plays on its own copy. The visitor's page waits underneath with its state intact. */}
        {running && (
          <div key="tour" data-tour-page>
            <TourPage value={true}>
              <Pages location={location} />
            </TourPage>
          </div>
        )}
        <div key="visitor" hidden={running}>
          <Pages location={origin ?? location} />
        </div>
      </main>
      <footer className="on-dark bg-navy-950">
        <div className="wrap flex flex-col gap-2 py-7 sm:flex-row sm:items-center sm:justify-between">
          <Brand />
          <p className="text-sm text-navy-200">A student project for Hash It Out 2026. The names and amounts are made up, and no real money moves.</p>
        </div>
      </footer>
    </div>
  )
}
