import { useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { Chip, Label } from '../../../shared/components/ui'
import { useNav } from '../../../nav'
import type { CombatSport } from '../../../types'
import { SportHistory } from '../components/SportHistory'
import { TechniqueFigure } from '../components/TechniqueFigure'
import { VideosPanel } from '../components/VideosPanel'
import { categoriesOf, libraryOf, searchTechniques } from '../services/combatLibraryService'
import { INTENSITY_LABEL } from '../services/combatService'

const INNER = [['tech', 'Técnicas'], ['train', 'Entrenos'], ['video', 'Vídeos'], ['hist', 'Historial'], ['tips', 'Consejos']] as const
type Inner = (typeof INNER)[number][0]

/** Contenido propio de UNA disciplina: biblioteca técnica, entrenos, vídeos, historial y consejos. */
export function DisciplinePanel({ sport }: { sport: CombatSport }) {
  const lib = libraryOf(sport)
  const { push } = useNav()
  const [inner, setInner] = useState<Inner>('tech')
  const [cat, setCat] = useState<string | undefined>()
  const techs = searchTechniques(sport, '', cat)
  return (
    <div className="scroll h-full pb-8">
      <div className="px-6 pt-4">
        <h2 className="text-[24px] font-bold tracking-tight leading-tight">{sport}</h2>
        <p className="text-mute text-[14.5px] mt-1 leading-snug">{lib.tagline}</p>
        <div className="flex p-1 bg-s2 rounded-xl mt-4 overflow-x-auto scroll" role="tablist">
          {INNER.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={inner === k} onClick={() => setInner(k)} className={`flex-1 shrink-0 h-9 px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap ${inner === k ? 'bg-s3 text-white' : 'text-mute'}`}>{l}</button>
          ))}
        </div>

        {inner === 'tech' && (
          <div className="mt-4">
            <p className="text-[13.5px] text-mute leading-relaxed">{lib.description}</p>
            <div className="flex gap-2 overflow-x-auto scroll mt-4 -mx-6 px-6 pb-1">
              <Chip active={!cat} onClick={() => setCat(undefined)}>Todas</Chip>
              {categoriesOf(sport).map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? undefined : c)}>{c}</Chip>)}
            </div>
            <div className="mt-2">
              {techs.map((t) => (
                <button key={t.id} onClick={() => push({ name: 'combat.technique', sport, id: t.id })} className="w-full flex items-center gap-4 py-3.5 border-b border-line/70 last:border-0 text-left active:bg-s1">
                  <div className="w-14 h-14 rounded-2xl bg-s1 grid place-items-center shrink-0">{t.anim ? <TechniqueFigure anim={t.anim} animated={false} className="w-12 h-12" /> : <Icon name="glove" size={22} className="text-dim" />}</div>
                  <div className="flex-1 min-w-0"><div className="font-semibold leading-snug">{t.name}</div><div className="text-[12.5px] text-mute mt-0.5">{t.category} · {t.level}</div><div className="text-[12.5px] text-dim mt-0.5 line-clamp-2">{t.summary}</div></div>
                  <Icon name="chev" size={16} className="text-dim" />
                </button>
              ))}
            </div>
          </div>
        )}

        {inner === 'train' && (
          <div className="mt-4">
            {lib.trainings.map((t) => (
              <button key={t.id} onClick={() => push({ name: 'combat.training', sport, id: t.id })} className="w-full text-left py-4 border-b border-line/70 last:border-0 active:bg-s1">
                <div className="flex items-center gap-2"><span className="text-[18px] font-bold tracking-tight">{t.name}</span><span className="ml-auto num text-[13px] text-mute">{t.minutes} min</span></div>
                <div className="text-[13px] text-mute mt-1 leading-snug">{t.goal}</div>
                <span className="inline-block mt-2 text-[11px] font-semibold bg-s2 text-mute rounded-full px-2.5 py-1">Intensidad orientativa: {INTENSITY_LABEL[t.intensity].toLowerCase()}</span>
              </button>
            ))}
          </div>
        )}

        {inner === 'video' && <div className="mt-4"><VideosPanel sport={sport} /></div>}
        {inner === 'hist' && <div className="mt-5"><SportHistory sport={sport} /></div>}
        {inner === 'tips' && (
          <div className="mt-5"><Label>Consejos de {sport}</Label>
            <ul className="mt-3 space-y-4">{lib.tips.map((t, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><Icon name="info" size={18} className="shrink-0 mt-0.5 text-glow" />{t}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  )
}
