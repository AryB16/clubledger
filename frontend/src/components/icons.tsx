const PATHS = {
  check: 'M4.5 12.5l5 5 10-11',
  cross: 'M6 6l12 12M18 6L6 18',
  out: 'M7 17L17 7M9 7h8v8',
  pencil: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3',
  minus: 'M5 12h14',
  play: 'M8 5.5v13l10-6.5z',
  search: 'M16 16l4.5 4.5M18 10.5a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z',
  copy: 'M9 9h10.5v10.5H9zM15 9V4.5H4.5V15H9',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.4 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z',
  people: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.3a3.5 3.5 0 010 6.4M18 14.2a6.5 6.5 0 013.5 5.8',
  home: 'M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4z',
}

export function Icon({ name, className = 'h-4 w-4' }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 ${className}`}>
      <path d={PATHS[name]} />
    </svg>
  )
}
