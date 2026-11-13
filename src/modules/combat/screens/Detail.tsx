import { useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { Button, Header, Label } from '../../../shared/components/ui'
import { useNav } from '../../../nav'
import { CombatSheet } from '../components/CombatSheet'
import { TechniqueFigure } from '../components/TechniqueFigure'
import { VideosPanel } from '../components/VideosPanel'
import { findTechnique, findTraining, isSport } from '../services/combatLibraryService'
import { INTENSITY_LABEL } from '../services/combatService'

export function TechniqueDetail({ sport, id }: { sport: string; id: string }) {
  const { pop } = useNav()
  const t = isSport(sport) ? findTechnique(sport, id) : undefined
  if (!t || !isSport(sport)) return null
  return (
    <div className="h-full flex flex-col">
      <Header onBack={pop} />
      <div className="scroll flex-1 pb-10">
        {t.anim && (
          <div className="mx-6 rounded-3xl bg-s1 aspect-[4/3] grid place-items-center overflow-hidden relative">
            <TechniqueFigure anim={t.anim} className="w-[88%] h-[92%]" />
            <span className="absolute left-4 bottom-3 text-[11px] font-semibold uppercase tracking-wider text-dim">Ejecución en solitario</span>
          </div>
        )}
        <div className="px-6 mt-6">
          <Label>{sport} · {t.category} · {t.level}</Label>
          <h1 className="display text-[44px] mt-1.5">{t.name}</h1>
          <p className="text-mute text-[15px] leading-relaxed mt-3">{t.summary}</p>
          <Label className="mt-9">Cómo se hace</Label>
          <ol className="mt-3 space-y-4">{t.steps.map((s, i) => <li key={i} className="flex gap-4"><span className="num w-6 shrink-0 text-glow font-bold text-lg leading-snug">{i + 1}</span><span className="text-[15.5px] leading-relaxed text-[#d8d8dc]">{s}</span></li>)}</ol>
          <Label className="mt-9">Claves</Label>
          <ul className="mt-3 space-y-2.5">{t.cues.map((c, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-mute"><Icon name="check" size={18} className="shrink-0 mt-0.5 text-glow" />{c}</li>)}</ul>
          <Label className="mt-9">Errores comunes</Label>
          <ul className="mt-3 space-y-2.5">{t.mistakes.map((c, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-mute"><Icon name="x" size={18} className="shrink-0 mt-0.5 text-danger" />{c}</li>)}</ul>
          <Label className="mt-9">Mis vídeos de esta técnica</Label>
          <div className="mt-3"><VideosPanel sport={sport} techniqueId={t.id} /></div>
        </div>
      </div>
    </div>
  )
}

export function TrainingDetail({ sport, id }: { sport: string; id: string }) {
  const { pop } = useNav()
  const [log, setLog] = useState(false)
  const t = isSport(sport) ? findTraining(sport, id) : undefined
  if (!t || !isSport(sport)) return null
  const names = t.techniques.map((tid) => findTechnique(sport, tid)?.name).filter((n): n is string => !!n)
  return (
    <div className="h-full flex flex-col">
      <Header onBack={pop} />
      <div className="scroll flex-1 px-6 pb-10">
        <Label>{sport} · {t.minutes} min · intensidad orientativa {INTENSITY_LABEL[t.intensity].toLowerCase()}</Label>
        <h1 className="display text-[44px] mt-1.5">{t.name}</h1>
        <p className="text-mute text-[15px] leading-relaxed mt-3">{t.goal}</p>
        <Label className="mt-9">Bloques</Label>
        <div className="mt-1">{t.blocks.map((b, i) => (
          <div key={i} className="flex gap-4 py-4 border-b border-line/70 last:border-0"><span className="num w-12 shrink-0 text-glow font-bold">{b.minutes}′</span><div><div className="font-semibold">{b.name}</div><div className="text-[14px] text-mute leading-snug mt-0.5">{b.detail}</div></div></div>
        ))}</div>
        {names.length > 0 && <p className="text-[13.5px] text-mute mt-6 leading-relaxed"><span className="text-white font-semibold">Técnicas clave:</span> {names.join(' · ')}</p>}
        <Button className="w-full mt-8" onClick={() => setLog(true)}>REGISTRAR ESTA SESIÓN</Button>
      </div>
      <CombatSheet open={log} onClose={() => setLog(false)} preset={{ sport, minutes: t.minutes, techniques: names }} />
    </div>
  )
}
