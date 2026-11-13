/** Navegación interna de una sección: chips en píldora (activo en blanco), con scroll horizontal. */
export function SubTabs({ id, items, value, onChange }: { id: string; items: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div role="tablist" aria-label={id} className="flex gap-2 overflow-x-auto scroll px-6 py-2">
      {items.map((it) => {
        const on = it.key === value
        return (
          <button key={it.key} role="tab" aria-selected={on} onClick={() => onChange(it.key)}
            ref={(el) => { if (on && el) el.scrollIntoView({ inline: 'center', block: 'nearest' }) }}
            className={`shrink-0 h-10 px-5 rounded-full text-[14px] font-medium transition backdrop-blur-xl ${on ? 'bg-white text-black' : 'bg-white/10 text-white/85 ring-1 ring-inset ring-white/15'}`}>
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
