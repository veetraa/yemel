import { motion } from 'framer-motion'

/** Navegación interna de una sección (cada pestaña principal tiene la suya). */
export function SubTabs({ id, items, value, onChange }: { id: string; items: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto scroll px-6 border-b border-line/70">
      {items.map((it) => {
        const on = it.key === value
        return (
          <button key={it.key} role="tab" aria-selected={on} onClick={() => onChange(it.key)} className={`relative shrink-0 h-11 px-3 text-[14px] font-semibold transition-colors ${on ? 'text-white' : 'text-dim'}`}>
            {it.label}
            {on && <motion.span layoutId={`sub-${id}`} className="absolute left-2 right-2 bottom-0 h-[2px] bg-accent rounded-full" />}
          </button>
        )
      })}
    </div>
  )
}
