import { motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { RoutineForm } from '../components/RoutineForm'
import { Button, Header, Label, Sheet } from '../components/ui'
import { SAMPLE_JSON } from '../data/sampleJson'
import { copyText, readFileText } from '../lib/files'
import { hasErrors, parseJsonRoutine, parseTextRoutine, type ImportResult } from '../lib/importer'
import { SCHEMA_EXAMPLE, chatGptPrompt } from '../lib/prompt'
import { useNav } from '../nav'
import { useStore } from '../store'
import type { Routine } from '../types'
import { suggestWeekdays } from '../lib/profile'
import { scheduleNotes } from '../lib/coach'

type Mode = 'json' | 'text' | 'file'
const LEVEL = {
  error: { c: 'text-danger', bg: 'bg-danger/10', icon: 'x', t: 'Error' },
  warning: { c: 'text-[#ffb340]', bg: 'bg-[#ffb340]/10', icon: 'info', t: 'Aviso' },
  info: { c: 'text-mute', bg: 'bg-s2', icon: 'info', t: 'Info' },
} as const

const TEXT_PLACEHOLDER = `Rutina: Fuerza 3 días
Día 1 - Empuje
- Press banca 4x6-8 descanso 150s peso 60kg
- Press militar 3x8-10 descanso 120s
Día 2 - Tirón
- Dominadas 4x6-8 descanso 90s
- Remo con barra 3x10 - 90s`

export function ImportScreen() {
  const { saveRoutine, showToast, profile } = useStore()
  const { pop, replace } = useNav()
  const [mode, setMode] = useState<Mode>('json')
  const [input, setInput] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [draft, setDraft] = useState<Routine | null>(null)
  const [help, setHelp] = useState(false)
  const preview = useRef<HTMLDivElement>(null)

  const analyze = (text = input, m: Mode = mode) => {
    const r = m === 'text' ? parseTextRoutine(text) : parseJsonRoutine(text)
    setResult(r)
    setDraft(r.routine ?? null)
    setTimeout(() => preview.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const onFile = async (f?: File) => {
    if (!f) return
    const text = await readFileText(f)
    const m: Mode = /\.json$/i.test(f.name) || /^\s*[{[`]/.test(text) ? 'json' : 'text'
    setInput(text); setMode(m); analyze(text, m)
  }

  const save = () => {
    if (!draft) return
    saveRoutine({ ...draft, name: draft.name.trim() || 'Rutina importada' })
    showToast('Rutina guardada')
    replace({ name: 'routine', id: draft.id })
  }

  const errors = result ? hasErrors(result) : false
  const counts = draft ? { d: draft.days.length, e: draft.days.reduce((a, d) => a + d.exercises.length, 0) } : null

  return (
    <div className="h-full flex flex-col">
      <Header title="Importar rutina" onBack={pop} />
      <div className="scroll flex-1 px-6 pb-10">
        <p className="text-mute text-[15px] leading-relaxed">Pídele una rutina a ChatGPT con nuestro prompt, pega la respuesta aquí y revísala antes de guardarla.</p>

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
              placeholder={mode === 'json' ? SCHEMA_EXAMPLE : TEXT_PLACEHOLDER}
              className="w-full h-56 bg-s1 border border-line rounded-2xl p-4 text-[14px] leading-snug font-mono placeholder:text-dim resize-none" />
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

        <button className="text-[13px] text-mute underline underline-offset-4 mt-4" onClick={() => { setMode('json'); setInput(SAMPLE_JSON); analyze(SAMPLE_JSON, 'json') }}>
          Cargar rutina de ejemplo
        </button>

        <div ref={preview} className="scroll-mt-4" />
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
            <Label>Resultado del análisis</Label>
            {counts && !errors && (
              <div className="mt-2 flex items-center gap-2 text-accent font-semibold"><Icon name="check" size={18} stroke={2.6} /> Rutina válida: {counts.d} días · {counts.e} ejercicios</div>
            )}
            {result.issues.length > 0 && (
              <ul className="mt-3 space-y-2">
                {[...result.issues].sort((a, b) => ['error', 'warning', 'info'].indexOf(a.level) - ['error', 'warning', 'info'].indexOf(b.level)).map((i, n) => {
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
                <Label>{errors ? 'Vista previa parcial' : 'Vista previa · editable'}</Label>
                <div className="mt-4 space-y-4">
                  <Button variant="secondary" size="md" className="w-full" onClick={() => {
                    const picks = suggestWeekdays(draft.days.length, profile)
                    setDraft({ ...draft, days: draft.days.map((d, i) => ({ ...d, weekdays: picks[i] !== undefined ? [picks[i]] : [] })) })
                    showToast('Días asignados según tu disponibilidad')
                  }}>Asignar días según mi perfil</Button>
                  {scheduleNotes(profile, draft.days).map((n, i) => <p key={i} className="text-[13px] text-[#ffb340] leading-snug">⚠ {n}</p>)}
                  <RoutineForm routine={draft} onChange={setDraft} />
                </div>
                <div className="mt-8 space-y-2">
                  {errors ? (
                    <>
                      <p className="text-[13px] text-mute leading-snug">Hay errores: lo marcado como «Error» se omitiría. Corrige el texto y vuelve a analizar para no perder nada, o importa solo lo válido.</p>
                      <Button variant="secondary" className="w-full" onClick={save}>IMPORTAR SOLO LO VÁLIDO</Button>
                    </>
                  ) : (
                    <Button className="w-full" onClick={save} disabled={!draft.days.length}>GUARDAR RUTINA</Button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <Sheet open={help} onClose={() => setHelp(false)} title="Formato JSON estándar">
        <p className="text-mute text-[14px] leading-relaxed">También acepta claves en español (<code>nombre</code>, <code>dias</code>, <code>ejercicios</code>, <code>series</code>, <code>repeticiones</code>, <code>descanso</code>). El descanso va en segundos; <code>weekdays</code> usa 0 = lunes … 6 = domingo o nombres.</p>
        <pre className="mt-4 bg-s2 rounded-xl p-4 text-[12px] leading-snug overflow-x-auto font-mono select-text">{SCHEMA_EXAMPLE}</pre>
        <div className="flex gap-2 mt-4">
          <Button size="md" variant="secondary" className="flex-1" onClick={async () => showToast((await copyText(SCHEMA_EXAMPLE)) ? 'Formato copiado' : 'No se pudo copiar')}>Copiar formato</Button>
          <Button size="md" className="flex-1" onClick={() => { setInput(SCHEMA_EXAMPLE); setMode('json'); setHelp(false) }}>Usar como plantilla</Button>
        </div>
      </Sheet>
    </div>
  )
}
