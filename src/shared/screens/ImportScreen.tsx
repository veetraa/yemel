/**
 * Importación desde ChatGPT. Una sola pantalla, tres alcances INDEPENDIENTES:
 *  · gym     → solo rutinas de musculación y ejercicios de fuerza personalizados
 *  · combat  → solo sesiones/planificación de combate
 *  · hybrid  → planificación híbrida completa (cada parte se entrega a su módulo)
 */
import { motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Button, Header, Label, Sheet } from '../components/ui'
import { RoutineForm } from '../../modules/gym/components/RoutineForm'
import { SAMPLE_JSON } from '../../modules/gym/data/sampleJson'
import { SCHEMA_EXAMPLE, gymChatGptPrompt } from '../../modules/gym/services/gymImportService'
import { COMBAT_EXAMPLE, combatPrompt } from '../../modules/combat/services/combatImportService'
import { INTENSITY_LABEL } from '../../modules/combat/services/combatService'
import { copyText, readFileText } from '../lib/files'
import { WEEKDAYS } from '../lib/utils'
import { HYBRID_EXAMPLE, analyzeBundle, applyBundle, chatGptPrompt, parseBundle, type ImportBundle, type ImportScope } from '../services/hybridImportService'
import { combatDays, suggestWeekdays } from '../services/planningService'
import { useNav } from '../../nav'
import { useStore } from '../../store'
import type { CombatSport, Routine } from '../../types'

type Mode = 'json' | 'text' | 'file'
const LEVEL = {
  error: { c: 'text-danger', bg: 'bg-danger/10', t: 'Error' },
  warning: { c: 'text-[#ffb340]', bg: 'bg-[#ffb340]/10', t: 'Aviso' },
  info: { c: 'text-mute', bg: 'bg-s2', t: 'Info' },
} as const
const ORDER = ['error', 'warning', 'info']

const TEXT_PLACEHOLDER = `Rutina: Fuerza 3 días
Día 1 - Empuje
- Press banca 4x6-8 descanso 150s peso 60kg
- Press militar 3x8-10 descanso 120s
Día 2 - Tirón
- Dominadas 4x6-8 descanso 90s
- Remo con barra 3x10 - 90s`

const CFG: Record<ImportScope, { title: string; intro: string; example: string; prompt: () => string; text: boolean; sample?: string; sections: string }> = {
  gym: { title: 'Importar rutina de gym', intro: 'Copia el prompt, pégalo en ChatGPT y pega aquí la respuesta.', example: SCHEMA_EXAMPLE, prompt: gymChatGptPrompt, text: true, sample: SAMPLE_JSON, sections: 'days, customExercises' },
  combat: { title: 'Importar sesiones de combate', intro: 'Pega aquí tu planificación de combate.', example: COMBAT_EXAMPLE, prompt: combatPrompt, text: false, sections: 'sessions' },
  hybrid: { title: 'Planificación híbrida', intro: 'Un JSON con rutina, semana, combate y atleta.', example: HYBRID_EXAMPLE, prompt: chatGptPrompt, text: true, sections: 'days, week, mma, customExercises, athlete' },
}

export function ImportScreen({ scope }: { scope: ImportScope }) {
  const cfg = CFG[scope]
  const { applyImport, showToast, profile, plan, planRoutine, combatPlan } = useStore()
  const { pop, replace } = useNav()
  const [mode, setMode] = useState<Mode>('json')
  const [input, setInput] = useState('')
  const [bundle, setBundle] = useState<ImportBundle | null>(null)
  const [draft, setDraft] = useState<Routine | null>(null)
  const [help, setHelp] = useState(false)
  const preview = useRef<HTMLDivElement>(null)
  const defaultSport = (profile.primaryDiscipline && ['MMA', 'Brazilian Jiu-Jitsu', 'Boxeo', 'Kickboxing', 'Wrestling'].includes(profile.primaryDiscipline) ? profile.primaryDiscipline : 'MMA') as CombatSport

  const analyze = (text = input) => {
    const b = parseBundle(text, { routine: planRoutine, defaultSport }, scope)
    setBundle(b)
    setDraft(b.routine ?? null)
    setTimeout(() => preview.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }
  const onFile = async (f?: File) => {
    if (!f) return
    const text = await readFileText(f)
    setInput(text); setMode(/\.json$/i.test(f.name) || /^\s*[{[`]/.test(text) ? 'json' : 'text'); analyze(text)
  }

  const current = useMemo(() => (bundle ? { ...bundle, routine: draft ?? undefined } : null), [bundle, draft])
  const analysis = useMemo(() => (current ? analyzeBundle(current, { profile, routine: planRoutine, combatPlan }) : null), [current, profile, planRoutine, combatPlan])
  const parseErrors = bundle?.issues.filter((i) => i.level === 'error') ?? []
  const sessions = current ? [...(current.week?.combat ?? []), ...(current.combatSessions ?? [])] : []
  const anything = !!(current?.routine || sessions.length || current?.week || current?.customExercises?.length || current?.athlete)

  const save = (includeWeek: boolean) => {
    if (!current || !analysis) return
    const applied = applyBundle(current, analysis, { includeWeek })
    if (applied.routine) applied.routine = { ...applied.routine, name: applied.routine.name.trim() || 'Rutina importada' }
    applyImport(applied)
    showToast('Importado')
    if (applied.routine && scope === 'gym') replace({ name: 'gym.routine', id: applied.routine.id }); else pop()
  }

  type Row = { level: 'error' | 'warning' | 'info'; message: string; path?: string; fix?: string }
  const issues: Row[] = [
    ...(bundle?.issues ?? []),
    ...(analysis?.issues.filter((i) => analysis.weekChanged || i.code === 'VOLUME_CAP' || i.code === 'TOO_LONG') ?? []),
  ].sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level))
  const blocked = !!analysis?.weekBlocked
  const weekWord = scope === 'gym' ? 'los días de la semana' : 'la semana'

  return (
    <div className="h-full flex flex-col">
      <Header title={cfg.title} onBack={pop} />
      <div className="scroll flex-1 px-6 pb-10">
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Pasos de la importación">
          {['Copiar prompt', 'Pegar JSON', 'Revisar', 'Confirmar'].map((l, i) => {
            const at = !bundle ? (input.trim() ? 1 : 0) : 2
            return (
              <li key={l} aria-current={i === at ? 'step' : undefined} className="flex flex-col items-center gap-1.5 text-center">
                <span className={`w-7 h-7 rounded-full grid place-items-center text-[13px] font-bold ${i < at ? 'bg-accent text-black' : i === at ? 'bg-white/15 ring-1 ring-inset ring-white/40 text-white' : 'bg-s2 text-dim'}`}>{i < at ? <Icon name="check" size={14} stroke={3.2} /> : i + 1}</span>
                <span className={`text-[11px] font-semibold leading-tight ${i === at ? 'text-white' : 'text-dim'}`}>{l}</span>
              </li>
            )
          })}
        </ol>
        <p className="text-mute text-[15px] leading-relaxed mt-5">{cfg.intro}</p>
        <div className="flex gap-2 mt-4">
          <Button size="sm" variant="secondary" onClick={async () => showToast((await copyText(cfg.prompt())) ? 'Prompt copiado. Pégalo en ChatGPT' : 'No se pudo copiar')}><Icon name="copy" size={16} /> Copiar prompt para ChatGPT</Button>
          <Button size="sm" variant="ghost" onClick={() => setHelp(true)}>Ver formato</Button>
        </div>

        <div className="mt-7 flex p-1 bg-s2 rounded-2xl">
          {([['json', 'JSON'], ['text', 'Texto'], ['file', 'Archivo']] as const).filter(([k]) => k !== 'text' || cfg.text).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className="relative flex-1 h-10 text-sm font-semibold">
              {mode === k && <motion.div layoutId={`impmode-${scope}`} className="absolute inset-0 bg-s3 rounded-xl" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <span className={`relative ${mode === k ? 'text-white' : 'text-mute'}`}>{l}</span>
            </button>
          ))}
        </div>

        {mode !== 'file' ? (
          <div className="mt-4">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off"
              placeholder={mode === 'json' ? cfg.example : TEXT_PLACEHOLDER}
              className="w-full h-56 bg-s1 border border-line rounded-2xl p-4 text-[13.5px] leading-snug font-mono placeholder:text-dim resize-none" />
            <div className="flex gap-2 mt-3">
              <Button variant="secondary" size="md" onClick={async () => { try { setInput(await navigator.clipboard.readText()) } catch { showToast('Pega el texto manualmente (mantén pulsado)') } }}>Pegar</Button>
              <Button size="md" className="flex-1" disabled={!input.trim()} onClick={() => analyze()}>REVISAR</Button>
            </div>
          </div>
        ) : (
          <label className="mt-4 block border border-dashed border-line rounded-2xl py-12 text-center active:bg-s1">
            <input type="file" accept=".json,.txt,.md,application/json,text/plain" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
            <div className="mx-auto w-12 h-12 rounded-full bg-s2 grid place-items-center text-glow"><Icon name="file" size={22} /></div>
            <div className="font-semibold mt-3">Elegir archivo .json{cfg.text ? ' o .txt' : ''}</div>
            <div className="text-[13px] text-mute mt-1">Desde Archivos, iCloud Drive o descargas</div>
          </label>
        )}

        {cfg.sample && <button className="text-[13px] text-mute underline underline-offset-4 mt-4" onClick={() => { setMode('json'); setInput(cfg.sample!); analyze(cfg.sample) }}>Cargar rutina de ejemplo</button>}

        <div ref={preview} className="scroll-mt-4" />
        {bundle && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
            <Label>Revisa antes de confirmar</Label>
            {anything && !parseErrors.length && !blocked && <div className="mt-2 flex items-center gap-2 text-glow font-semibold"><Icon name="check" size={18} stroke={2.6} /> Listo para importar</div>}
            {blocked && <div className="mt-2 rounded-xl bg-danger/10 px-3.5 py-3 text-[14px] leading-snug" role="alert"><b className="text-danger">{scope === 'gym' ? 'Esos días rompen' : 'La semana propuesta rompe'} las reglas de recuperación.</b> Puedes importar el resto sin {weekWord}, o corregir el JSON y volver a analizar.</div>}

            {anything && (
              <ul className="mt-4 bg-s1 rounded-2xl divide-y divide-line/70">
                {current?.routine && <Part title="Rutina de gimnasio → GYM" text={`${draft?.name ?? ''} · ${draft?.days.length ?? 0} días · ${draft?.days.reduce((a, d) => a + d.exercises.length, 0) ?? 0} ejercicios`} />}
                {!!sessions.length && <Part title="Sesiones de combate → COMBAT" text={sessions.map((s) => `${WEEKDAYS[s.day].slice(0, 3)} ${s.sport} (${INTENSITY_LABEL[s.intensity].toLowerCase()}${s.sparring ? ', sparring' : ''})`).join(' · ')} bad={blocked} />}
                {current?.week && <Part title="Semana (gym, combate, recuperación)" text={current.week.entries.map((e) => `${WEEKDAYS[e.day].slice(0, 3)} ${e.type === 'gym' ? 'gym' : e.type === 'combat' ? 'combate' : e.type === 'recovery' ? 'recup.' : 'descanso'}`).join(' · ')} bad={blocked} />}
                {!!current?.customExercises?.length && <Part title="Ejercicios personalizados → GYM" text={current.customExercises.map((e) => e.name).join(', ')} />}
                {current?.athlete && <Part title="Perfil de atleta → Perfil" text={Object.entries(current.athlete).map(([k, v]) => `${k}: ${v}`).join(' · ')} />}
              </ul>
            )}

            {issues.length > 0 && (
              <ul className="mt-4 space-y-2">
                {issues.map((i, n) => {
                  const L = LEVEL[i.level]
                  return (
                    <li key={n} className={`${L.bg} rounded-xl px-3.5 py-3`}>
                      <div className={`text-[12px] font-bold uppercase tracking-wider ${L.c}`}>{L.t}{i.path && <span className="font-mono normal-case tracking-normal text-dim ml-2">{i.path}</span>}</div>
                      <div className="text-[14.5px] mt-1 leading-snug">{i.message}</div>
                      {i.fix && <div className="text-[13px] text-mute mt-1.5 leading-snug whitespace-pre-line"><span className="font-semibold text-white">Cómo corregirlo: </span>{i.fix}</div>}
                    </li>
                  )
                })}
              </ul>
            )}

            {draft && scope !== 'combat' && (
              <div className="mt-10">
                <Label>Vista previa · editable</Label>
                <div className="mt-4 space-y-4">
                  <Button variant="secondary" size="md" className="w-full" onClick={() => {
                    const picks = suggestWeekdays(draft.days.length, profile, combatDays(plan))
                    setDraft({ ...draft, days: draft.days.map((d, i) => ({ ...d, weekdays: picks[i] !== undefined ? [picks[i]] : [] })) })
                    showToast('Días asignados según tu perfil')
                  }}>Asignar días según mi perfil</Button>
                  <RoutineForm routine={draft} onChange={setDraft} />
                </div>
              </div>
            )}

            {anything && (
              <div className="mt-8 space-y-2">
                {parseErrors.length ? (
                  <>
                    <p className="text-[13px] text-mute leading-snug">Lo marcado como «Error» se omitirá.</p>
                    <Button variant="secondary" className="w-full" onClick={() => save(!blocked)}>IMPORTAR SOLO LO VÁLIDO</Button>
                  </>
                ) : blocked ? (
                  <Button className="w-full" onClick={() => save(false)}>{current?.routine ? `IMPORTAR SIN ${weekWord.toUpperCase()}` : 'NO SE PUEDE APLICAR'}</Button>
                ) : (
                  <Button className="w-full" onClick={() => save(true)}>CONFIRMAR IMPORTACIÓN</Button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      <Sheet open={help} onClose={() => setHelp(false)} title="Formato JSON">
        <p className="text-mute text-[14px] leading-relaxed">Secciones: <code>{cfg.sections}</code>. Descanso en segundos; días 0–6 (0 = lunes).</p>
        <pre className="mt-4 bg-s2 rounded-xl p-4 text-[11.5px] leading-snug overflow-x-auto font-mono select-text">{cfg.example}</pre>
        <div className="flex gap-2 mt-4">
          <Button size="md" variant="secondary" className="flex-1" onClick={async () => showToast((await copyText(cfg.example)) ? 'Formato copiado' : 'No se pudo copiar')}>Copiar formato</Button>
          <Button size="md" className="flex-1" onClick={() => { setInput(cfg.example); setMode('json'); setHelp(false) }}>Usar como plantilla</Button>
        </div>
      </Sheet>
    </div>
  )
}

function Part({ title, text, bad }: { title: string; text: string; bad?: boolean }) {
  return (
    <li className="px-4 py-3 flex gap-3 items-start">
      <span className={`mt-0.5 w-5 h-5 rounded-full grid place-items-center shrink-0 ${bad ? 'bg-danger text-white' : 'bg-accent text-black'}`}><Icon name={bad ? 'x' : 'check'} size={12} stroke={3.4} /></span>
      <div className="min-w-0"><div className="font-semibold text-[14.5px]">{title}</div><div className="text-[12.5px] text-mute leading-snug mt-0.5 break-words">{text}</div></div>
    </li>
  )
}
