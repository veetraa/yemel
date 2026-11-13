import { useMemo, useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { Button, Chip, Label } from '../../../shared/components/ui'
import { copyText } from '../../../shared/lib/files'
import { formatDateShort } from '../../../shared/lib/utils'
import { readiness } from '../../../shared/services/recoveryService'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'
import { PHILOSOPHERS } from '../data/philosophers'
import { QUOTES, THEMES } from '../data/quotes'
import { PILLARS, REFLECTIONS } from '../data/reflections'
import { entryPreview, entryTitle, journalStreak, philosopherById, quoteById, quoteOfDay, reflectionById, searchJournal, searchQuotes, suggestedReflection, suggestedTheme } from '../services/philosophyService'
import { usePhilosophy } from '../store'
import type { PhiloTheme, Quote } from '../types'

export function QuoteCard({ q, big = false }: { q: Quote; big?: boolean }) {
  const { favorites, toggleFav } = usePhilosophy()
  const { showToast } = useStore()
  const fav = favorites.quotes.includes(q.id)
  return (
    <figure className="m-0">
      <blockquote className={`m-0 font-semibold tracking-tight text-white ${big ? 'text-[26px] leading-[1.25]' : 'text-[17px] leading-snug'}`}>«{q.text}»</blockquote>
      <figcaption className="mt-3 text-[13.5px] text-mute">{q.author}{q.work ? <span className="text-dim"> · {q.work}</span> : null}</figcaption>
      <div className="flex gap-2 mt-3">
        <button onClick={() => toggleFav('quotes', q.id)} aria-pressed={fav} aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'} className={`h-9 px-3.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5 ${fav ? 'bg-accent text-black' : 'bg-s2 text-mute'}`}><Icon name="heart" size={15} stroke={2.2} />{fav ? 'Favorita' : 'Guardar'}</button>
        <button onClick={async () => showToast((await copyText(`«${q.text}» — ${q.author}`)) ? 'Frase copiada' : 'No se pudo copiar')} aria-label="Copiar frase" className="h-9 px-3.5 rounded-full text-[13px] font-semibold bg-s2 text-mute flex items-center gap-1.5"><Icon name="copy" size={15} />Copiar</button>
      </div>
    </figure>
  )
}

/** HOY: frase del día, reflexión sugerida y diario. */
export function TodayPanel() {
  const { wellness } = useStore()
  const { journal } = usePhilosophy()
  const { push, setSub } = useNav()
  const level = readiness(wellness).level
  const [offset, setOffset] = useState(0)
  const theme = suggestedTheme(level)
  const q = quoteOfDay(new Date(), undefined, offset)
  const refl = suggestedReflection(new Date(), level)
  const streak = journalStreak(journal)
  return (
    <div className="scroll h-full pb-8">
      <div className="px-6 pt-5">
        <Label>Frase del día</Label>
        <div className="mt-3"><QuoteCard q={q} big /></div>
        <button onClick={() => setOffset(offset + 1)} className="mt-4 text-[13px] font-semibold text-accent">Otra frase</button>

        <div className="mt-9 bg-s1 rounded-2xl p-4">
          <Label>Reflexión sugerida · {refl.when.toLowerCase()}</Label>
          <div className="font-bold text-[18px] mt-1.5">{refl.title}</div>
          <p className="text-[13.5px] text-mute leading-snug mt-1">{level === 'low' ? 'Tu recuperación está baja: hoy encaja mejor calma que exigencia. ' : ''}{refl.intro}</p>
          <Button className="w-full mt-4" onClick={() => push({ name: 'philo.reflection', id: refl.id })}>HACER LA REFLEXIÓN · {refl.minutes} MIN</Button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <button onClick={() => push({ name: 'philo.entry', id: `new:q:${q.id}` })} className="bg-s1 rounded-2xl p-4 text-left active:bg-s2"><Icon name="book" size={20} className="text-accent" /><div className="font-bold mt-2.5">Escribir en el diario</div><div className="text-[12.5px] text-mute mt-0.5">{streak > 0 ? `${streak} día${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''}` : 'Empieza hoy'}</div></button>
          <button onClick={() => setSub('philosophy', 'pillars')} className="bg-s1 rounded-2xl p-4 text-left active:bg-s2"><Icon name="column" size={20} className="text-accent" /><div className="font-bold mt-2.5">Pilares</div><div className="text-[12.5px] text-mute mt-0.5">Disciplina · Autocontrol · Resiliencia</div></button>
        </div>
        <p className="text-[12px] text-dim mt-6 leading-snug">Tema de hoy: {THEMES.find((t) => t.key === theme)?.label}. Las frases son adaptaciones al español, no traducciones literales.</p>
      </div>
    </div>
  )
}

export function QuotesPanel() {
  const [q, setQ] = useState('')
  const [theme, setTheme] = useState<PhiloTheme | undefined>()
  const list = useMemo(() => searchQuotes(q, theme), [q, theme])
  return (
    <div className="scroll h-full pb-8">
      <div className="px-6 pt-4">
        <div className="flex items-center gap-2 bg-s2 rounded-xl h-11 px-3"><Icon name="search" size={18} className="text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar frase o autor" aria-label="Buscar frase o autor" className="bg-transparent flex-1" /></div>
        <div className="flex gap-2 overflow-x-auto scroll mt-3 -mx-6 px-6 pb-1"><Chip active={!theme} onClick={() => setTheme(undefined)}>Todas</Chip>{THEMES.map((t) => <Chip key={t.key} active={theme === t.key} onClick={() => setTheme(theme === t.key ? undefined : t.key)}>{t.label}</Chip>)}</div>
        <Label className="mt-5">{list.length} frases</Label>
        <div className="mt-2">{list.map((x) => <div key={x.id} className="py-5 border-b border-line/70 last:border-0"><QuoteCard q={x} /></div>)}</div>
      </div>
    </div>
  )
}

export function PhilosophersPanel() {
  const { push } = useNav()
  return (
    <div className="scroll h-full pb-8"><div className="px-6 pt-3">
      {PHILOSOPHERS.map((p) => (
        <button key={p.id} onClick={() => push({ name: 'philo.philosopher', id: p.id })} className="w-full flex items-center gap-4 py-4 border-b border-line/70 last:border-0 text-left active:bg-s1">
          <div className="w-12 h-12 rounded-full bg-s2 grid place-items-center text-[18px] font-bold text-accent shrink-0">{p.name[0]}</div>
          <div className="flex-1 min-w-0"><div className="font-bold text-[17px]">{p.name}</div><div className="text-[12.5px] text-mute mt-0.5">{p.role} · {p.years}</div></div>
          <Icon name="chev" size={16} className="text-dim" />
        </button>
      ))}
    </div></div>
  )
}

export function ReflectionsPanel() {
  const { push } = useNav()
  return (
    <div className="scroll h-full pb-8"><div className="px-6 pt-3">
      <p className="text-[13.5px] text-mute leading-relaxed pt-1">Prácticas guiadas de pocos minutos. Al terminar se guardan en tu diario.</p>
      {REFLECTIONS.map((r) => (
        <button key={r.id} onClick={() => push({ name: 'philo.reflection', id: r.id })} className="w-full text-left py-4 border-b border-line/70 last:border-0 active:bg-s1">
          <div className="flex items-center gap-2"><span className="font-bold text-[17px]">{r.title}</span><span className="ml-auto num text-[12.5px] text-mute">{r.minutes} min</span></div>
          <div className="text-[12.5px] text-dim mt-0.5">{r.when}</div>
          <div className="text-[13.5px] text-mute leading-snug mt-1">{r.intro}</div>
        </button>
      ))}
    </div></div>
  )
}

export function PillarsPanel() {
  const { push } = useNav()
  return (
    <div className="scroll h-full pb-8"><div className="px-6 pt-4 space-y-3">
      {PILLARS.map((p) => (
        <button key={p.id} onClick={() => push({ name: 'philo.pillar', id: p.id })} className="w-full text-left bg-s1 rounded-2xl p-5 active:bg-s2">
          <div className="flex items-center"><span className="text-[22px] font-bold tracking-tight">{p.title}</span><Icon name="chev" size={18} className="text-dim ml-auto" /></div>
          <p className="text-[14px] text-mute leading-snug mt-2">{p.definition}</p>
        </button>
      ))}
    </div></div>
  )
}

export function JournalPanel() {
  const { journal } = usePhilosophy()
  const { push } = useNav()
  const [q, setQ] = useState('')
  const list = searchJournal(journal, q)
  const streak = journalStreak(journal)
  return (
    <div className="scroll h-full pb-8"><div className="px-6 pt-4">
      <Button className="w-full" onClick={() => push({ name: 'philo.entry', id: 'new' })}><Icon name="plus" size={18} /> NUEVA ENTRADA</Button>
      {journal.length > 0 && (
        <>
          <div className="flex items-center gap-2 bg-s2 rounded-xl h-11 px-3 mt-4"><Icon name="search" size={18} className="text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en tu diario" aria-label="Buscar en tu diario" className="bg-transparent flex-1" /></div>
          <div className="text-[12.5px] text-mute mt-3">{journal.length} entradas · {streak > 0 ? `${streak} día${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''}` : 'sin racha'} · solo en este dispositivo</div>
        </>
      )}
      {journal.length === 0 ? (
        <div className="text-center px-6 py-12"><div className="mx-auto w-14 h-14 rounded-full bg-s2 grid place-items-center text-mute"><Icon name="book" size={26} /></div><div className="text-lg font-bold mt-4">Tu diario está vacío</div><p className="text-mute text-[15px] leading-relaxed mt-2">Escribe unas líneas al día o haz una reflexión guiada. Es privado y nunca sale de tu iPhone.</p></div>
      ) : (
        <div className="mt-2">{list.map((e) => (
          <button key={e.id} onClick={() => push({ name: 'philo.entry', id: e.id })} className="w-full text-left py-4 border-b border-line/70 last:border-0 active:bg-s1">
            <div className="flex items-center"><span className="font-bold truncate">{entryTitle(e)}</span><span className="ml-auto text-[12.5px] text-mute shrink-0 pl-3">{formatDateShort(e.ts)}</span></div>
            <div className="text-[13.5px] text-mute leading-snug mt-1 line-clamp-2">{entryPreview(e) || '—'}</div>
          </button>
        ))}{!list.length && <p className="text-mute text-center py-10">Sin resultados.</p>}</div>
      )}
    </div></div>
  )
}

export function FavoritesPanel() {
  const { favorites } = usePhilosophy()
  const { push } = useNav()
  const quotes = favorites.quotes.map(quoteById).filter((x): x is Quote => !!x)
  const phs = favorites.philosophers.map(philosopherById).filter(Boolean)
  const refs = favorites.reflections.map(reflectionById).filter(Boolean)
  if (!quotes.length && !phs.length && !refs.length) return (
    <div className="scroll h-full"><div className="text-center px-6 py-16"><div className="mx-auto w-14 h-14 rounded-full bg-s2 grid place-items-center text-mute"><Icon name="heart" size={26} /></div><div className="text-lg font-bold mt-4">Sin favoritos todavía</div><p className="text-mute text-[15px] leading-relaxed mt-2">Toca «Guardar» en una frase, o el corazón en un filósofo o una reflexión, y aparecerán aquí.</p></div></div>
  )
  return (
    <div className="scroll h-full pb-8"><div className="px-6 pt-4">
      {quotes.length > 0 && <><Label>Frases</Label><div className="mt-1">{quotes.map((q) => <div key={q.id} className="py-5 border-b border-line/70 last:border-0"><QuoteCard q={q} /></div>)}</div></>}
      {phs.length > 0 && <><Label className="mt-6">Filósofos</Label><div className="mt-1">{phs.map((p) => p && <button key={p.id} onClick={() => push({ name: 'philo.philosopher', id: p.id })} className="w-full text-left py-3.5 border-b border-line/70 last:border-0 font-semibold">{p.name} <span className="text-mute font-normal text-[13px]">· {p.years}</span></button>)}</div></>}
      {refs.length > 0 && <><Label className="mt-6">Reflexiones</Label><div className="mt-1">{refs.map((r) => r && <button key={r.id} onClick={() => push({ name: 'philo.reflection', id: r.id })} className="w-full text-left py-3.5 border-b border-line/70 last:border-0 font-semibold">{r.title}</button>)}</div></>}
    </div></div>
  )
}

export { QUOTES }
