// The guided tour, one step per feature, in the order a first-time visitor would use them.
export interface Step {
  route: string
  /** Matches data-tour="…". data-tour-part="…" marks smaller pieces to ring when the whole won't fit, largest first. */
  target: string
  caption: string
  ms: number
  event?: TourAction
  /** Counted on the tour's clock, so pausing holds it back too. */
  eventDelay?: number
  /** A pointer that glides to data-tour-click="…" and presses it, so a change on screen always has a visible cause. */
  cursor?: Cursor
}

export interface Cursor {
  target: string
  /** When the pointer sets off, on the tour's clock. */
  at: number
  /** Press on arrival, then do this: go to the next step, or send a tour event. Without it the pointer only points. */
  then?: 'advance' | TourAction
}

export type TourAction = 'type-example' | 'point-at-total' | 'mark-address' | 'show-expenses'

/** A real receipt that was corrected. The tour only reads it. */
export const EXAMPLE_CODE = 'EXP-0002'

export const STEPS: Step[] = [
  {
    route: '/',
    target: 'balance',
    caption: "This is the club's recorded balance. It shows what came in, what went out and what's left.",
    ms: 7000,
  },
  {
    route: '/',
    target: 'search',
    caption: 'This is the receipt checker. Type the number from any receipt to look it up, with no account needed.',
    // The press on Check opens the next step, so the bar is timed to end with it.
    ms: 4300,
    event: 'type-example',
    eventDelay: 700,
    cursor: { target: 'check', at: 2900, then: 'advance' },
  },
  {
    route: `/check/${EXAMPLE_CODE}`,
    target: 'verdict',
    caption: "This is a receipt's result. It tells you at a glance if the record is genuine, corrected, cancelled or missing.",
    ms: 7000,
  },
  {
    route: '/',
    target: 'rules',
    caption: 'These are the four rules every entry must pass. Real examples let you see what is allowed and what is refused.',
    ms: 8000,
  },
  {
    route: '/',
    target: 'latest',
    caption: "This is the account book. Each line shows the balance after it, so you can follow the money to today's total.",
    ms: 8000,
    event: 'point-at-total',
    eventDelay: 1800,
  },
  {
    route: '/',
    target: 'contract',
    caption: 'This is the address of the public record. Copy it to check the numbers yourself, without trusting this website.',
    ms: 7000,
    event: 'mark-address',
    eventDelay: 1200,
    cursor: { target: 'copy', at: 1900 },
  },
  {
    route: '/ledger',
    target: 'filters',
    caption: 'This is the list of every entry. Switch tabs to see only the income or only the expenses.',
    ms: 8000,
    cursor: { target: 'expense', at: 1300, then: 'show-expenses' },
  },
  {
    route: '/manage',
    target: 'manage',
    caption: "This is the treasurers' area. Only approved treasurers can add entries, and anyone else is refused.",
    ms: 7000,
  },
]
