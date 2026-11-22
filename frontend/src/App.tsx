import { useLayoutEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Check from './pages/Check'
import Ledger from './pages/Ledger'
import Manage from './pages/Manage'
import { PageHead } from './components/ui'

const nav = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-2 text-sm font-medium transition-colors min-[360px]:px-3 sm:px-4 ${
    isActive ? 'bg-white/15 text-white' : 'text-navy-200 hover:text-white'
  }`

function Brand() {
  return (
    <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-display text-lg font-bold text-white sm:text-xl">
      <img src="/favicon.svg" alt="" width="30" height="30" className="h-7.5 w-7.5" />
      <span className="max-[339px]:sr-only">ClubLedger</span>
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

export default function App() {
  return (
    <div className="min-h-dvh">
      <ScrollToTop />
      <header className="on-dark bg-navy-950">
        <div className="wrap flex items-center justify-between gap-1 py-3">
          <Brand />
          <nav aria-label="Main" className="flex items-center sm:gap-1">
            <NavLink to="/ledger" className={nav}>
              All entries
            </NavLink>
            <NavLink to="/manage" className={nav}>
              Treasurers
            </NavLink>
          </nav>
        </div>
      </header>
      {/* A full screen tall, so the footer never jumps while the record loads. */}
      <main className="page min-h-dvh">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/check/:code" element={<Check />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
