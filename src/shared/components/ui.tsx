import { AnimatePresence, motion } from 'framer-motion'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../lib/utils'
import { Icon } from './Icon'

export function Button({
  variant = 'primary', size = 'lg', className = '', children, onClick, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' }) {
  const v = {
    primary: 'bg-accent text-black font-semibold tracking-wide active:scale-[0.985] active:bg-white/85',
    secondary: 'bg-black/35 text-white font-semibold ring-1 ring-inset ring-white/15 backdrop-blur-xl active:bg-white/15',
    ghost: 'bg-transparent text-mute font-semibold active:text-white',
    danger: 'bg-danger/15 text-danger font-semibold ring-1 ring-inset ring-danger/25 active:bg-danger/25',
  }[variant]
  const s = { sm: 'h-9 px-4 text-sm rounded-full', md: 'h-11 px-5 text-[15px] rounded-full', lg: 'h-14 px-6 text-base rounded-full' }[size]
  return (
    <button
      {...rest}
      onClick={(e) => { haptic(8); onClick?.(e) }}
      className={`${v} ${s} inline-flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  )
}

export function Header({ title, onBack, right, large = false }: { title?: string; onBack?: () => void; right?: ReactNode; large?: boolean }) {
  return (
    <div className="pt-safe px-6 pb-2 flex items-center gap-3 min-h-[56px]">
      {onBack && (
        <button onClick={onBack} aria-label="Atrás" className="-ml-2 w-10 h-10 grid place-items-center rounded-full bg-black/30 ring-1 ring-inset ring-white/15 backdrop-blur-xl active:bg-white/15 text-white">
          <Icon name="back" />
        </button>
      )}
      {title && <h1 className={`flex-1 truncate ${large ? 'display text-[46px] leading-[0.95] text-shadow-soft' : 'text-lg font-semibold tracking-tight'}`}>{title}</h1>}
      {!title && <div className="flex-1" />}
      {right}
    </div>
  )
}

export const Label = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] text-mute ${className}`}>{children}</div>
)

export function Chip({ children, active, onClick, className = '' }: { children: ReactNode; active?: boolean; onClick?: () => void; className?: string }) {
  const base = `inline-flex items-center h-9 px-4 rounded-full text-[13.5px] font-medium whitespace-nowrap transition backdrop-blur-xl ${active ? 'bg-white text-black' : 'bg-white/10 text-white/85 ring-1 ring-inset ring-white/15'} ${className}`
  return onClick ? <button onClick={onClick} className={base}>{children}</button> : <span className={base}>{children}</span>
}

/** Hoja inferior de cristal. Se pinta en un portal para quedar siempre por encima de la barra de navegación. */
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[3px]" />
          <motion.div key="sh" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            className="fixed left-0 right-0 bottom-0 z-50 glass-strong !bg-[rgba(12,19,28,.82)] rounded-t-[32px] max-h-[88dvh] flex flex-col">
            <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mt-2.5 shrink-0" />
            {title && <div className="display-b px-5 pt-3 pb-1 text-[26px]">{title}</div>}
            <div className="scroll px-5 pt-3 pb-safe pb-6 flex-1">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Stat({ label, value, unit, className = '' }: { label: string; value: ReactNode; unit?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="num text-[30px] font-semibold leading-none">
        {value}
        {unit && <span className="text-sm font-medium text-mute ml-1 tracking-normal">{unit}</span>}
      </div>
      <Label className="mt-1.5">{label}</Label>
    </div>
  )
}

export function Empty({ icon, title, text, children }: { icon: string; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-14 gap-3">
      <div className="w-14 h-14 rounded-full bg-s2 grid place-items-center text-white/80"><Icon name={icon} size={26} /></div>
      <div className="display-b text-[26px]">{title}</div>
      <p className="text-mute text-[15px] leading-relaxed max-w-[300px]">{text}</p>
      {children && <div className="mt-3 flex flex-col gap-2 w-full max-w-[280px]">{children}</div>}
    </div>
  )
}

export function Row({ children, onClick, className = '' }: { children: ReactNode; onClick?: () => void; className?: string }) {
  const c = `w-full text-left flex items-center gap-3 py-3.5 border-b border-white/10 last:border-0 ${onClick ? 'active:bg-white/5' : ''} ${className}`
  return onClick ? <button onClick={onClick} className={c}>{children}</button> : <div className={c}>{children}</div>
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`w-12 h-7 rounded-full p-0.5 transition ring-1 ring-inset ${on ? 'bg-white ring-white' : 'bg-white/10 ring-white/15'}`}>
      <motion.div layout transition={{ type: 'spring', stiffness: 500, damping: 34 }} className={`w-6 h-6 rounded-full ${on ? 'bg-black ml-auto' : 'bg-white/60'}`} />
    </button>
  )
}

export function Ring({ value, size = 64, stroke = 6, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.16)" strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }} transition={{ duration: 0.9, ease: 'easeOut' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
