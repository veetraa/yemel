import { useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { Button, Header, Label, Sheet } from '../../../shared/components/ui'
import { TextInput } from '../../../shared/components/fields'
import { formatDateLong } from '../../../shared/lib/utils'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'
import { PILLARS } from '../data/reflections'
import { QUOTES } from '../data/quotes'
import { isEntryEmpty, newEntry, philosopherById, quoteById, reflectionById } from '../services/philosophyService'
import { usePhilosophy } from '../store'
import type { JournalEntry } from '../types'
import { QuoteCard } from './Panels'

const FavButton = ({ kind, id }: { kind: 'philosophers' | 'reflections'; id: string }) => {
  const { favorites, toggleFav } = usePhilosophy()
  const on = favorites[kind].includes(id)
  return <button onClick={() => toggleFav(kind, id)} aria-pressed={on} aria-label={on ? 'Quitar de favoritos' : 'Guardar en favoritos'} className={`h-10 px-4 rounded-full text-sm font-semibold flex items-center gap-1.5 ${on ? 'bg-accent text-black' : 'bg-s2 text-mute'}`}><Icon name="heart" size={16} stroke={2.2} />{on ? 'Favorito' : 'Guardar'}</button>
}

export function PhilosopherDetail({ id }: { id: string }) {
  const { pop } = useNav()
  const p = philosopherById(id)
  if (!p) return null
  return (
    <div className="h-full flex flex-col">
      <Header onBack={pop} right={<FavButton kind="philosophers" id={p.id} />} />
      <div className="scroll flex-1 px-6 pb-10">
        <Label>{p.role} · {p.years}</Label>
        <h1 className="text-[30px] font-bold tracking-tight leading-tight mt-1.5">{p.name}</h1>
        <p className="text-[15.5px] leading-relaxed text-[#d8d8dc] mt-4">{p.bio}</p>
        <Label className="mt-9">Ideas clave</Label>
        <ul className="mt-3 space-y-2.5">{p.ideas.map((x, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-mute"><Icon name="check" size={18} className="shrink-0 mt-0.5 text-accent" />{x}</li>)}</ul>
        <Label className="mt-9">Por dónde empezar</Label>
        <p className="text-[15px] text-mute leading-relaxed mt-2">{p.startWith}</p>
        <Label className="mt-9">Frases</Label>
        <div className="mt-1">{p.quoteIds.map(quoteById).map((q) => q && <div key={q.id} className="py-5 border-b border-line/70 last:border-0"><QuoteCard q={q} /></div>)}</div>
      </div>
    </div>
  )
}

export function ReflectionDetail({ id }: { id: string }) {
  const { pop, replace } = useNav()
  const r = reflectionById(id)
  if (!r) return null
  return (
    <div className="h-full flex flex-col">
      <Header onBack={pop} right={<FavButton kind="reflections" id={r.id} />} />
      <div className="scroll flex-1 px-6 pb-10">
        <Label>{r.when} · {r.minutes} min</Label>
        <h1 className="text-[28px] font-bold tracking-tight leading-tight mt-1.5">{r.title}</h1>
        <p className="text-[15.5px] leading-relaxed text-[#d8d8dc] mt-3">{r.intro}</p>
        <Label className="mt-9">Preguntas</Label>
        <ol className="mt-3 space-y-4">{r.prompts.map((p, i) => <li key={i} className="flex gap-4"><span className="num w-6 shrink-0 text-accent font-bold text-lg leading-snug">{i + 1}</span><span className="text-[16px] leading-relaxed">{p}</span></li>)}</ol>
        <Button className="w-full mt-10" onClick={() => replace({ name: 'philo.entry', id: `new:r:${r.id}` })}>EMPEZAR Y ESCRIBIR</Button>
        <p className="text-[12px] text-dim mt-3 text-center">Se guardará en tu diario, privado en este dispositivo.</p>
      </div>
    </div>
  )
}

export function PillarDetail({ id }: { id: string }) {
  const { push, pop } = useNav()
  const p = PILLARS.find((x) => x.id === id)
  if (!p) return null
  const quotes = QUOTES.filter((q) => q.themes.includes(p.id)).slice(0, 5)
  return (
    <div className="h-full flex flex-col">
      <Header onBack={pop} />
      <div className="scroll flex-1 px-6 pb-10">
        <Label>Pilar</Label>
        <h1 className="text-[32px] font-bold tracking-tight leading-tight mt-1.5">{p.title}</h1>
        <p className="text-[15.5px] leading-relaxed text-[#d8d8dc] mt-3">{p.definition}</p>
        <Label className="mt-9">Principios</Label>
        <ul className="mt-3 space-y-2.5">{p.principles.map((x, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-mute"><Icon name="check" size={18} className="shrink-0 mt-0.5 text-accent" />{x}</li>)}</ul>
        <Label className="mt-9">Prácticas</Label>
        <ol className="mt-3 space-y-3">{p.practices.map((x, i) => <li key={i} className="flex gap-4"><span className="num w-6 shrink-0 text-accent font-bold text-lg leading-snug">{i + 1}</span><span className="text-[15.5px] leading-relaxed">{x}</span></li>)}</ol>
        <Label className="mt-9">Reflexiones relacionadas</Label>
        <div className="mt-1">{p.reflectionIds.map(reflectionById).map((r) => r && <button key={r.id} onClick={() => push({ name: 'philo.reflection', id: r.id })} className="w-full flex items-center py-3.5 border-b border-line/70 last:border-0 text-left font-semibold">{r.title}<Icon name="chev" size={16} className="text-dim ml-auto" /></button>)}</div>
        <Label className="mt-9">Frases</Label>
        <div className="mt-1">{quotes.map((q) => <div key={q.id} className="py-5 border-b border-line/70 last:border-0"><QuoteCard q={q} /></div>)}</div>
      </div>
    </div>
  )
}

/** Editor del diario. id: 'new' | 'new:r:<reflexión>' | 'new:q:<frase>' | id de una entrada existente */
export function EntryEditor({ id }: { id: string }) {
  const { journal, saveEntry, deleteEntry } = usePhilosophy()
  const { showToast } = useStore()
  const { pop } = useNav()
  const existing = journal.find((e) => e.id === id)
  const [e, setE] = useState<JournalEntry>(() => {
    if (existing) return existing
    const m = id.match(/^new:(r|q):(.+)$/)
    if (m?.[1] === 'r') { const r = reflectionById(m[2]); return newEntry({ kind: 'reflection', reflectionId: r?.id, prompts: r?.prompts.map((q) => ({ q, a: '' })) }) }
    if (m?.[1] === 'q') return newEntry({ quoteId: m[2] })
    return newEntry()
  })
  const [confirm, setConfirm] = useState(false)
  const quote = quoteById(e.quoteId)
  const save = () => {
    if (isEntryEmpty(e)) return showToast('Escribe algo antes de guardar')
    saveEntry(e)
    showToast('Guardado en tu diario')
    pop()
  }
  return (
    <div className="h-full flex flex-col">
      <Header title={existing ? 'Editar entrada' : e.kind === 'reflection' ? 'Reflexión' : 'Nueva entrada'} onBack={pop} right={existing ? <button onClick={() => setConfirm(true)} aria-label="Eliminar entrada" className="w-10 h-10 grid place-items-center text-dim"><Icon name="trash" size={19} /></button> : undefined} />
      <div className="scroll flex-1 px-6 pb-8">
        <div className="text-[12.5px] text-mute first-letter:uppercase">{formatDateLong(new Date(e.ts))}</div>
        {quote && <div className="mt-4 bg-s1 rounded-2xl p-4"><QuoteCard q={quote} /></div>}
        <div className="mt-5"><TextInput label="Título (opcional)" value={e.title ?? ''} onChange={(v) => setE({ ...e, title: v || undefined })} placeholder={e.kind === 'reflection' ? reflectionById(e.reflectionId)?.title : 'Un título breve'} /></div>
        {e.prompts?.map((p, i) => (
          <div key={i} className="mt-5">
            <label className="block text-[15px] font-semibold leading-snug mb-2" htmlFor={`p-${i}`}>{i + 1}. {p.q}</label>
            <textarea id={`p-${i}`} value={p.a} onChange={(ev) => setE({ ...e, prompts: e.prompts!.map((x, j) => (j === i ? { ...x, a: ev.target.value } : x)) })} rows={3} className="w-full bg-s1 border border-line rounded-2xl p-3.5 text-[16px] leading-snug resize-none" />
          </div>
        ))}
        <div className="mt-5">
          <label htmlFor="free" className="block text-[15px] font-semibold mb-2">{e.prompts?.length ? 'Notas libres' : 'Tu diario'}</label>
          <textarea id="free" value={e.text} onChange={(ev) => setE({ ...e, text: ev.target.value })} rows={e.prompts?.length ? 3 : 9} placeholder="Escribe con libertad. Es privado." className="w-full bg-s1 border border-line rounded-2xl p-3.5 text-[16px] leading-snug resize-none placeholder:text-dim" />
        </div>
      </div>
      <div className="px-6 pt-3 pb-safe pb-4 border-t border-line/70"><Button className="w-full" onClick={save}>GUARDAR</Button></div>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Eliminar esta entrada?">
        <p className="text-mute">Se borrará de tu diario. No se puede deshacer.</p>
        <div className="flex gap-2 mt-5"><Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Cancelar</Button><Button variant="danger" className="flex-1" onClick={() => { deleteEntry(e.id); setConfirm(false); pop() }}>Eliminar</Button></div>
      </Sheet>
    </div>
  )
}
