import { NavLink, Route, Routes, Link } from 'react-router-dom'
import Home from './pages/Home'
import Check from './pages/Check'
import Ledger from './pages/Ledger'
import Manage from './pages/Manage'

const nav = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium ${
    isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'
  }`

export default function App() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-2">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-slate-900">
            <img src="/favicon.svg" alt="" className="h-6 w-6" />
            ClubLedger
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/ledger" className={nav}>
              All entries
            </NavLink>
            <NavLink to="/manage" className={nav}>
              Treasurers
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/check/:code" element={<Check />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/manage" element={<Manage />} />
          <Route
            path="*"
            element={
              <p className="text-slate-600">
                Page not found. <Link to="/" className="font-medium text-emerald-700 underline">Go home</Link>
              </p>
            }
          />
        </Routes>
      </main>
    </div>
  )
}
