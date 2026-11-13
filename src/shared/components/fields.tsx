import { AnimatePresence, motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { WEEKDAYS_SHORT } from '../lib/utils'
import { Icon } from './Icon'
import { Label } from './ui'

export function Tile({ label, children, className = '', hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <div className={`bg-s1 rounded-2xl px-4 py-3 ${className}`}>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <div className="text-[11.5px] text-dim mt-1 leading-snug">{hint}</div>}
    </div>
  )
}

/** Campo numérico que tolera estados intermedios ("", "6.") y no inventa valores */
export function NumInput({ label, value, onChange, unit, decimal = false, min = 0, max = 9999, hint, deferred = false, className = '' }: {
  label: string; value: number | undefined; onChange: (n: number | undefined) => void; unit?: string; decimal?: boolean; min?: number; max?: number; hint?: string; deferred?: boolean; className?: string
}) {
  const [raw, setRaw] = useState<string | null>(null)
  const shown = raw ?? (value === undefined ? '' : String(value))
  const parse = (t: string) => (t === '' || t === '.' ? undefined : Math.min(max, Math.max(min, parseFloat(t))))
  return (
    <Tile label={label} hint={hint} className={className}>
      <div className="flex items-baseline gap-1.5">
        <input
          inputMode={decimal ? 'decimal' : 'numeric'} aria-label={label} placeholder="—" value={shown}
          onFocus={(e) => e.target.select()}
          onBlur={() => { if (deferred && raw !== null) onChange(parse(raw)); setRaw(null) }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          onChange={(e) => {
            const t = e.target.value.replace(',', '.')
            if (!/^\d*\.?\d*$/.test(t)) return
            setRaw(t)
            if (!deferred) onChange(parse(t))
          }}
          className="num bg-transparent w-full min-w-0 text-[26px] font-bold placeholder:text-dim"
        />
        {unit && <span className="text-mute text-sm font-semibold shrink-0">{unit}</span>}
      </div>
    </Tile>
  )
}

export function TextInput({ label, value, onChange, placeholder, type = 'text', hint, className = '' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; hint?: string; className?: string }) {
  return (
    <Tile label={label} hint={hint} className={className}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
        className="bg-transparent w-full text-[20px] font-bold placeholder:text-dim [color-scheme:dark] min-h-[32px]" />
    </Tile>
  )
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T | undefined; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex p-1 bg-s2 rounded-xl">
      {options.map((o) => (
        <button key={String(o.v)} onClick={() => onChange(o.v)} aria-pressed={value === o.v} className={`flex-1 h-9 rounded-lg text-[13px] font-semibold transition ${value === o.v ? 'bg-s3 text-white' : 'text-mute'}`}>{o.l}</button>
      ))}
    </div>
  )
}

export function MultiChips({ options, value, onChange, single = false }: { options: string[]; value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  const toggle = (o: string) => {
    if (single) return onChange(value[0] === o ? [] : [o])
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {[...options, ...value.filter((v) => !options.includes(v))].map((o) => {
        const on = value.includes(o)
        return <button key={o} onClick={() => toggle(o)} aria-pressed={on} className={`h-9 px-3.5 rounded-full text-[13.5px] font-semibold transition ${on ? 'bg-white text-black' : 'bg-s2 text-mute active:bg-s3'}`}>{o}</button>
      })}
    </div>
  )
}

export function WeekdayChips({ value, onChange, mark }: { value: number[]; onChange: (v: number[]) => void; mark?: number[] }) {
  return (
    <div className="flex gap-1.5">
      {WEEKDAYS_SHORT.map((l, i) => {
        const on = value.includes(i)
        return (
          <button key={i} onClick={() => onChange(on ? value.filter((x) => x !== i) : [...value, i].sort())} aria-pressed={on} aria-label={`Día ${l}`}
            className={`relative w-10 h-10 rounded-full text-[13px] font-bold ${on ? 'bg-accent text-black' : 'bg-s2 text-mute'}`}>
            {l}
            {mark?.includes(i) && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-glow bg-bg rounded px-1">JJ</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Valoración 1-5 opcional: tocar de nuevo la opción elegida la borra */
export function Rating({ label, value, onChange, low, high }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; low: string; high: string }) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <span className="text-[14.5px] font-semibold">{label}</span>
        <span className="text-[11.5px] text-dim">{low} → {high}</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5 mt-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(value === n ? undefined : n)} aria-pressed={value === n} aria-label={`${label} ${n} de 5`}
            className={`h-11 rounded-xl num font-bold text-[16px] transition ${value === n ? 'bg-accent text-black' : value !== undefined && n < value ? 'bg-s3 text-white' : 'bg-s2 text-mute'}`}>{n}</button>
        ))}
      </div>
    </div>
  )
}

export function Accordion({ title, summary, icon, open, onToggle, children }: { title: string; summary?: string; icon: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="border-b border-line/70">
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-4 py-5 text-left">
        <div className={`w-10 h-10 rounded-2xl grid place-items-center shrink-0 transition-colors ${open ? 'bg-accent text-black' : 'bg-s2 text-mute'}`}><Icon name={icon} size={19} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[18px] font-bold tracking-tight">{title}</div>
          {summary && !open && <div className="text-[13px] text-mute mt-0.5 truncate">{summary}</div>}
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-dim"><Icon name="down" size={18} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="pb-7 space-y-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export const SubLabel = ({ children }: { children: ReactNode }) => <div className="text-[13px] text-mute mb-2 font-medium">{children}</div>
