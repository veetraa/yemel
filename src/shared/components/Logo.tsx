/** Marca de Forma: tres estelas de velocidad + nombre en cursiva condensada. */
export function Mark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 24" fill="currentColor" className={className} aria-hidden>
      <path d="M0 12C10 3 24 2 40 5 28 7 14 9 0 12Z" />
      <path d="M4 18C14 10 26 9 42 12 30 14 18 15 4 18Z" />
      <path d="M10 23C18 17 30 16 43 19 33 21 22 22 10 23Z" />
    </svg>
  )
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2 text-white" aria-label="Forma">
      <Mark className="w-[38px] h-[21px]" />
      <span className="display" style={{ fontSize: size * 1.25, letterSpacing: '0.02em' }}>Forma</span>
    </div>
  )
}
