// Where to scroll and what to ring, so the caption card never sits on the highlighted feature.
export const BORDER = 3
export const OFFSET = 6
const OUT = BORDER + OFFSET
const GAP = 12

export interface Spot {
  el: HTMLElement
  rect: DOMRect
  /** Lowest point the ring may reach. */
  floor: number
  /** The scroll position that shows the feature clear of the card. */
  scrollTo: number
}

/** The target on the tour's copy of the page, if it is showing. */
export function findTarget(target: string) {
  const el = document.querySelector<HTMLElement>(`[data-tour-page] [data-tour="${target}"]`)
  return el && el.getClientRects().length ? el : null
}

export function placeSpot(whole: HTMLElement, card: HTMLElement): Spot {
  const { clientWidth: width, clientHeight: height, scrollHeight } = document.documentElement
  // offsetTop and offsetLeft ignore the slide-up transform, so the layout holds still while the card arrives.
  const floorFor = (r: DOMRect) => (Math.min(r.right, width) + OUT + GAP > card.offsetLeft ? card.offsetTop - GAP : height - GAP)

  let el = whole
  let rect = el.getBoundingClientRect()
  // On a short screen, step down through the marked parts, largest first, until one fits whole.
  for (const part of whole.querySelectorAll<HTMLElement>(`[data-tour-part="${whole.dataset.tour}"]`)) {
    if (rect.height + OUT * 2 + GAP <= floorFor(rect)) break
    if (!part.getClientRects().length) continue
    el = part
    rect = el.getBoundingClientRect()
  }
  const floor = floorFor(rect)
  const top = Math.max(OUT + GAP, (floor - rect.height) / 2)
  const scrollTo = Math.round(Math.min(scrollHeight - height, Math.max(0, rect.top + window.scrollY - top)))
  return { el, rect, floor, scrollTo: Math.max(0, scrollTo) }
}

export function drawRing(ring: HTMLElement, { el, rect, floor }: Spot) {
  const top = Math.max(2, rect.top - OUT)
  const bottom = Math.min(floor, rect.bottom + OUT)
  const left = Math.max(2, rect.left - OUT)
  const right = Math.min(document.documentElement.clientWidth - 2, rect.right + OUT)
  if (bottom - top < 24) return false
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 8
  Object.assign(ring.style, {
    top: `${top}px`,
    left: `${left}px`,
    width: `${right - left}px`,
    height: `${bottom - top}px`,
    borderRadius: `${Math.min(radius, 32) + OUT}px`,
  })
  return true
}
