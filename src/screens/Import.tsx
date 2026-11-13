import { motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { RoutineForm } from '../components/RoutineForm'
import { Button, Header, Label, Sheet } from '../components/ui'
import { SAMPLE_JSON } from '../data/sampleJson'
import { copyText, readFileText } from '../lib/files'
import { HYBRID_EXAMPLE, SCHEMA_EXAMPLE, analyzeBundle, applyBundle, chatGptPrompt, parseBundle, type ImportBundle } from '../services/importExportService'
import { SLOT_LABEL, suggestWeekdays, combatDays, syncRoutineWeekdays } from '../services/planningService'
import { WEEKDAYS } from '../lib/utils'
import { useNav } from '../nav'
import { useStore } from '../store'
import type { Routine } from '../types'

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

export function ImportScreen() {
  const { applyImport, showToast, profile, plan, planRoutine } = useStore()
  const { pop, replace } = useNav()
  const [mode, setMode] = useState<Mode>('json')
  const [input, setInput] = useState('')
  const [bundle, setBundle] = useState<ImportBundle | null>(null)
  const [draft, setDraft] = useState<Routine | null>(null)
  const [help, setHelp] = useState(false)
  const preview = useRef<HTMLDivElement>(null)

  const analyze = (text = input) => {
    const b = parseBundle(text, { routine: planRoutine })
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
  const analysis = useMemo(() => (current ? analyzeBundle(current, { profile, plan, routine: planRoutine }) : null), [current, profile, plan, planRoutine])
  const parseErrors = bundle?.issues.filter((i) => i.level === 'error') ?? []
  const anything = !!(current?.routine || current?.slots?.length || current?.customExercises?.length || current?.athlete)

  const save = (includePlan: boolean) => {
    if (!current || !analysis) return
    const applied = applyBundle(current, analysis, { includePlan }, syncRoutineWeekdays)
    if (applied.routine) applied.routine = { ...applied.routine, name: applied.routine.name.trim() || 'Rutina importada' }
    applyImport(applied)
    showToast(includePlan && applied.plan ? 'Planificación importada' : 'Importado')
    if (applied.routine) replace({ name: 'routine', id: applied.routine.id }); else pop()
  }

  type Row = { level: 'error' | 'warning' | 'info'; message: string; path?: string; fix?: string }
  const issues: Row[] = [
    ...(bundle?.issues ?? []),
    ...(analysis?.issues.filter((i) => analysis.planChanged || i.code === 'VOLUME_CAP' || i.code === 'TOO_LONG') ?? []),
  ]
  const showAll = issues.sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level))
  const blocked = !!analysis?.planBlocked
  const nonPlanErrors = parseErrors.length > 0

  return (
    <div className="h-full flex flex-col">
      <Header title="Importar" onBack={pop} />
      <div className="scroll flex-1 px-6 pb-10">
        <p className="text-mute text-[15px] leading-relaxed">Un único formato para rutinas de gimnasio, planificación de MMA, semanas híbridas completas y ejercicios personalizados. Pídeselo a ChatGPT con nuestro prompt y revisa los conflictos antes de guardar.</p>

        <div className="flex gap-2 mt-4">
          <Button size="sm" variant="secondary" onClick={async () => showToast((await copyText(chatGptPrompt())) ? 'Prompt copiado. Pégalo en ChatGPT' : 'No se pudo copiar')}><Icon name="copy" size={16} /> Copiar prompt para ChatGPT</Button>
          <Button size="sm" variant="ghost" onClick={() => setHelp(true)}>Ver formato</Button>
        </div>

        <div className="mt-7 flex p-1 bg-s2 rounded-2xl">
          {([['json', 'JSON'], ['text', 'Texto'], ['file', 'Archivo']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className="relative flex-1 h-10 text-sm font-semibold">
              {mode === k && <motion.div layoutId="impmode" className="absolute inset-0 bg-s3 rounded-xl" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <span className={`relative ${mode === k ? 'text-white' : 'text-mute'}`}>{l}</span>
            </button>
          ))}
        </div>

        {mode !== 'file' ? (
          <div className="mt-4">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off"
              placeholder={mode === 'json' ? HYBRID_EXAMPLE : TEXT_PLACEHOLDER}
              className="w-full h-56 bg-s1 border border-line rounded-2xl p-4 text-[13.5px] leading-snug font-mono placeholder:text-dim resize-none" />
            <div className="flex gap-2 mt-3">
              <Button variant="secondary" size="md" onClick={async () => { try { setInput(await navigator.clipboard.readText()) } catch { showToast('Pega el texto manualmente (mantén pulsado)') } }}>Pegar</Button>
              <Button size="md" className="flex-1" disabled={!input.trim()} onClick={() => analyze()}>ANALIZAR</Button>
            </div>
          </div>
        ) : (
          <label className="mt-4 block border border-dashed border-line rounded-2xl py-12 text-center active:bg-s1">
            <input type="file" accept=".json,.txt,.md,application/json,text/plain" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
            <div className="mx-auto w-12 h-12 rounded-full bg-s2 grid place-items-center text-accent"><Icon name="file" size={22} /></div>
            <div className="font-semibold mt-3">Elegir archivo .json o .txt</div>
            <div className="text-[13px] text-mute mt-1">Desde Archivos, iCloud Drive o descargas</div>
          </label>
        )}

        <button className="text-[13px] text-mute underline underline-offset-4 mt-4" onClick={() => { setMode('json'); setInput(SAMPLE_JSON); analyze(SAMPLE_JSON) }}>
          Cargar rutina de ejemplo
        </button>

        <div ref={preview} className="scroll-mt-4" />
        {bundle && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
            <Label>Resultado del análisis</Label>
            {anything && !nonPlanErrors && !blocked && <div className="mt-2 flex items-center gap-2 text-accent font-semibold"><Icon name="check" size={18} stroke={2.6} /> Listo para importar</div>}
            {blocked && <div className="mt-2 rounded-xl bg-danger/10 px-3.5 py-3 text-[14px] leading-snug" role="alert"><b className="text-danger">La semana propuesta rompe las reglas de recuperación.</b> Puedes importar el resto (rutina, ejercicios y perfil) sin la semana, o corregir el JSON y volver a analizar.</div>}

            {anything && (
              <ul className="mt-4 bg-s1 rounded-2xl divide-y divide-line/70">
                {current?.routine && <Part title="Rutina de gimnasio" text={`${draft?.name ?? ''} · ${draft?.days.length ?? 0} días · ${draft?.days.reduce((a, d) => a + d.exercises.length, 0) ?? 0} ejercicios`} />}
                {!!current?.slots?.length && <Part title="Semana / combate" text={current.slots.map((s) => `${WEEKDAYS[s.day].slice(0, 3)} ${SLOT_LABEL[s.type].toLowerCase()}`).join(' · ')} bad={blocked} />}
                {!!current?.customExercises?.length && <Part title="Ejercicios personalizados" text={current.customExercises.map((e) => e.name).join(', ')} />}
                {current?.athlete && <Part title="Perfil de atleta" text={Object.entries(current.athlete).map(([k, v]) => `${k}: ${v}`).join(' · ')} />}
              </ul>
            )}

            {showAll.length > 0 && (
              <ul className="mt-4 space-y-2">
                {showAll.map((i, n) => {
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

            {draft && (
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
                {nonPlanErrors ? (
                  <>
                    <p className="text-[13px] text-mute leading-snug">Hay errores: lo marcado como «Error» se omitiría. Corrige el texto y vuelve a analizar para no perder nada, o importa solo lo válido.</p>
                    <Button variant="secondary" className="w-full" onClick={() => save(!blocked)}>IMPORTAR SOLO LO VÁLIDO</Button>
                  </>
                ) : blocked ? (
                  <Button className="w-full" onClick={() => save(false)}>IMPORTAR SIN LA SEMANA</Button>
                ) : (
                  <Button className="w-full" onClick={() => save(true)}>{analysis?.planChanged ? 'GUARDAR E IMPORTAR LA SEMANA' : 'GUARDAR'}</Button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      <Sheet open={help} onClose={() => setHelp(false)} title="Formato JSON">
        <p className="text-mute text-[14px] leading-relaxed">Usa solo las secciones que necesites: <code>days</code> (rutina), <code>week</code> (semana), <code>mma</code> (sesiones de combate), <code>customExercises</code> y <code>athlete</code>. También acepta claves en español. El descanso va en segundos; los días, por nombre o 0–6 (0 = lunes).</p>
        <div className="text-[12px] font-semibold uppercase tracking-wider text-mute mt-5">Planificación híbrida</div>
        <pre className="mt-2 bg-s2 rounded-xl p-4 text-[11.5px] leading-snug overflow-x-auto font-mono select-text">{HYBRID_EXAMPLE}</pre>
        <div className="text-[12px] font-semibold uppercase tracking-wider text-mute mt-5">Solo rutina de gimnasio</div>
        <pre className="mt-2 bg-s2 rounded-xl p-4 text-[11.5px] leading-snug overflow-x-auto font-mono select-text">{SCHEMA_EXAMPLE}</pre>
        <div className="flex gap-2 mt-4">
          <Button size="md" variant="secondary" className="flex-1" onClick={async () => showToast((await copyText(HYBRID_EXAMPLE)) ? 'Formato copiado' : 'No se pudo copiar')}>Copiar formato</Button>
          <Button size="md" className="flex-1" onClick={() => { setInput(HYBRID_EXAMPLE); setMode('json'); setHelp(false) }}>Usar como plantilla</Button>
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
