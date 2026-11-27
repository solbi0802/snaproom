import type { CSSProperties } from 'react'

const paths = {
  lock: <><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7" /></>,
  image: <><rect x="2" y="2.5" width="12" height="11" rx="1.5" /><circle cx="6" cy="6" r="1" /><path d="m2.5 12 3.5-3.5 2.5 2.5 2-2 3 3" /></>,
  plus: <path d="M8 3v10M3 8h10" />,
  close: <path d="m4 4 8 8M4 12l8-8" />,
}

export function Icon({ name, size = 'default', className }: { name: keyof typeof paths; size?: 'default' | 'large'; className?: string }) {
  const dimension = size === 'large' ? 'var(--sr-icon-size-large)' : 'var(--sr-icon-size)'
  const style: CSSProperties = { width: dimension, height: dimension, flexShrink: 0 }
  return <svg style={style} className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
