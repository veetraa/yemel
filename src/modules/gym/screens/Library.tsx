import { useMemo, useState } from 'react'
import { ExerciseFigure } from '../components/ExerciseFigure'
import { DemoPlayer } from '../components/DemoPlayer'
import { Exercise3D } from '../components/Exercise3D'
import { ExerciseThumb } from '../components/ExerciseThumb'
import { HowToSheet } from '../components/HowToSheet'
import { Icon } from '../../../shared/components/Icon'
import { Hint } from '../../../shared/components/Hint'
import { Button, Chip, Header, Label } from '../../../shared/components/ui'
import { MUSCLES, allExercises, exerciseById } from '../data/exercises'
import { useLibraryExercise, useLibraryIndex } from '../library/hooks'
import { imagesOf } from '../library/library'
import { APPROVED_3D_MODELS, VIDEOS } from '../resources/catalog'
import { exerciseSeries } from '../services/workoutService'
import { formatDateShort, formatNumber, normalize, toDisplay } from '../../../shared/lib/utils'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'

interface Row { id: string; name: string; group: string; equipment: string[]; haystack: string; secondary: string[] }
const PAGE = 60

/** Biblioteca unificada de ejercicios (subsección de GYM): se descarga bajo demanda y se muestra por páginas. */
export function LibraryPanel() {
  const { push } = useNav()
  const [q, setQ] = useState('')
  const [m, setM] = useState<string | undefined>()
  const [pages, setPages] = useState(1)
  const index = useLibraryIndex()
  const rows = useMemo<Row[]>(() => {
    const core = new Map(allExercises().map((e) => [e.id, e]))
    // primero los ejercicios de la app (los de tus rutinas), después el resto de la biblioteca
    const ordered = [...(index ?? [])].sort((a, b) => Number(!!b.core) - Number(!!a.core))
    const fromIndex = ordered.map((i): Row => {
      const c = core.get(i.id)
      return { id: i.id, name: i.n, group: c?.primary ?? i.g, equipment: c?.equipment ?? i.e, secondary: c?.secondary ?? [], haystack: normalize([i.n, i.en ?? '', i.g, ...i.e, ...(c?.aliases ?? [])].join(' ')) }
    })
    const seen = new Set(fromIndex.map((r) => r.id))
    // ejercicios propios (creados o importados por el usuario) y, sin conexión, los de la app
    const own = allExercises().filter((e) => !seen.has(e.id)).map((e): Row => ({ id: e.id, name: e.name, group: e.primary, equipment: e.equipment, secondary: e.secondary, haystack: normalize([e.name, e.primary, ...e.aliases, ...e.equipment].join(' ')) }))
    return [...own, ...fromIndex]
  }, [index])
  const list = useMemo(() => {
    const n = normalize(q)
    return rows.filter((r) => (!m || r.group === m || r.secondary.includes(m)) && (!n || r.haystack.includes(n)))
  }, [rows, q, m])
  const shown = list.slice(0, PAGE * pages)
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-3">
        <Hint id="gym-library" className="mb-3">Toca un ejercicio para ver cómo se hace, sus músculos y los errores que evitar.</Hint>
        <div className="flex items-center gap-2 bg-s2 rounded-xl h-11 px-3">
          <Icon name="search" size={18} className="text-mute" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPages(1) }} placeholder="Buscar ejercicio, músculo o equipo" className="bg-transparent flex-1" />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto scroll py-3 px-6">
        {MUSCLES.map((x) => <Chip key={x} active={m === x} onClick={() => { setM(m === x ? undefined : x); setPages(1) }}>{x}</Chip>)}
      </div>
      <div className="scroll flex-1 px-6 pb-8">
        <Label className="mb-1">{list.length} ejercicios{!index ? ' · cargando biblioteca…' : ''}</Label>
        {shown.map((e) => (
          <button key={e.id} onClick={() => push({ name: 'gym.exercise', id: e.id })} className="w-full flex items-center gap-4 py-3 border-b border-line/70 last:border-0 text-left active:bg-s1">
            <div className="w-16 h-16 rounded-2xl bg-s1 grid place-items-center shrink-0 overflow-hidden"><ExerciseThumb exerciseId={e.id} name={e.name} className="w-14 h-14" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-snug">{e.name}</div>
              <div className="text-[13px] text-mute mt-0.5">{e.group}</div>
              <div className="text-[12px] text-dim mt-0.5 truncate">{e.equipment.join(' · ')}</div>
            </div>
            <Icon name="chev" size={16} className="text-dim" />
          </button>
        ))}
        {shown.length < list.length && <Button variant="secondary" size="md" className="w-full mt-4" onClick={() => setPages(pages + 1)}>Mostrar más ({list.length - shown.length})</Button>}
        {!list.length && <p className="text-mute text-center py-12">Sin resultados.</p>}
      </div>
    </div>
  )
}

const DIFFICULTY: Record<string, string> = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' }

/** Imagen de demostración (inicio / final) del propio ejercicio; sin imagen, la figura propia o un aviso. */
function Hero({ id, name }: { id: string; name: string }) {
  const lib = useLibraryExercise(id)
  const core = exerciseById(id)
  const img = imagesOf(lib)
  const [end, setEnd] = useState(false)
  const [failed, setFailed] = useState(false)
  const demo = VIDEOS[id]
  if (demo) return <DemoPlayer video={demo} name={name} />
  if (core && APPROVED_3D_MODELS.includes(id)) return <Exercise3D anim={core.anim} primary={core.primary} secondary={core.secondary} />
  const src = img ? (end && img.end ? img.end : img.start ?? img.main) : undefined
  return (
    <>
      <div className="mx-6 rounded-3xl bg-s1 aspect-[4/3] grid place-items-center overflow-hidden relative">
        {src && !failed ? (
          <img key={src} src={src} alt={`${name}: ${end ? 'posición final' : 'posición inicial'}`} decoding="async" onError={() => setFailed(true)} className="w-full h-full object-contain bg-white/95" />
        ) : core && lib !== undefined ? (
          <ExerciseFigure anim={core.anim} primary={core.primary} className="w-[88%] h-[92%]" />
        ) : (
          <div className="text-center text-dim px-6"><Icon name="bolt" size={26} className="mx-auto" /><div className="text-[13px] mt-2">{lib === undefined ? 'Cargando…' : failed ? 'Imagen no disponible sin conexión' : 'Sin imagen de referencia'}</div></div>
        )}
        <span className="absolute left-4 bottom-3 text-[11px] font-semibold uppercase tracking-wider text-dim bg-black/45 rounded-full px-2.5 py-1">{img?.end && src && !failed ? (end ? 'Final' : 'Inicio') : 'Referencia'}</span>
      </div>
      {img?.end && !failed && (
        <div className="mx-6 mt-3 flex gap-2">
          <Chip active={!end} className="!px-3.5" onClick={() => setEnd(false)}>Inicio</Chip>
          <Chip active={end} className="!px-3.5" onClick={() => setEnd(true)}>Final</Chip>
        </div>
      )}
    </>
  )
}

export function ExerciseDetail({ id }: { id: string }) {
  const { pop } = useNav()
  const { sessions, settings } = useStore()
  const core = exerciseById(id)
  const lib = useLibraryExercise(id)
  const name = core?.name ?? lib?.name
  const series = useMemo(() => (name ? exerciseSeries(sessions, name, id) : []), [sessions, name, id])
  const [howTo, setHowTo] = useState(false)
  if (!core && lib === undefined) return <div className="h-full flex flex-col"><Header onBack={pop} /></div>
  if (!core && !lib) return <div className="h-full flex flex-col"><Header onBack={pop} /><p className="px-6 text-mute">Ejercicio no disponible.</p></div>
  const primary = core?.primary ?? lib!.primary
  const secondary = core?.secondary ?? lib?.secondary ?? []
  const equipment = core?.equipment ?? lib?.equipment ?? []
  const steps = (lib?.steps?.length ? lib.steps : core?.steps) ?? []
  const cues = lib?.cues?.length ? lib.cues : core?.tips ?? []
  const mistakes = lib?.mistakes ?? []
  const best = series.length ? series.reduce((a, b) => (b.e1rm > a.e1rm ? b : a)) : null
  const last = series[series.length - 1]
  const u = settings.unit
  const dif = lib?.difficulty ? DIFFICULTY[lib.difficulty] : null
  return (
    <div className="h-full flex flex-col">
      <Header onBack={pop} />
      <div className="scroll flex-1 pb-10">
        <Hero id={id} name={name!} />
        <div className="px-6 mt-6">
          <h1 className="display text-[44px]">{name}</h1>
          <Button variant="secondary" size="md" className="w-full mt-4 tracking-[0.06em]" onClick={() => setHowTo(true)}><Icon name="play" size={16} /> CÓMO SE HACE</Button>

          <div className="mt-6 grid grid-cols-1 gap-5">
            <div>
              <Label>Músculo principal</Label>
              <div className="mt-2 flex flex-wrap gap-2"><Chip active className="!bg-accent !text-black">{primary}</Chip>{dif && <Chip>{dif}</Chip>}</div>
            </div>
            {secondary.length > 0 && (
              <div>
                <Label>Músculos secundarios</Label>
                <div className="mt-2 flex flex-wrap gap-2">{secondary.map((s) => <Chip key={s}>{s}</Chip>)}</div>
              </div>
            )}
            {equipment.length > 0 && (
              <div>
                <Label>Equipamiento</Label>
                <div className="mt-2 flex flex-wrap gap-2">{equipment.map((s) => <Chip key={s}>{s}</Chip>)}</div>
              </div>
            )}
            {lib && lib.anatomy.length > 0 && (
              <div>
                <Label>Anatomía</Label>
                <p className="mt-2 text-[14px] text-mute leading-snug">{lib.anatomy.join(' · ')}</p>
              </div>
            )}
          </div>

          {best && last && (
            <div className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <div className="num text-[28px] font-bold leading-none">{formatNumber(toDisplay(last.topWeight, u))}<span className="text-sm text-mute ml-1">{u}</span></div>
                <Label className="mt-1.5">Último · {formatDateShort(last.ts)}</Label>
              </div>
              <div>
                <div className="num text-[28px] font-bold leading-none">{formatNumber(toDisplay(best.e1rm, u))}<span className="text-sm text-mute ml-1">{u}</span></div>
                <Label className="mt-1.5">1RM estimado</Label>
              </div>
            </div>
          )}

          {steps.length > 0 && (
            <>
              <Label className="mt-10">Cómo hacerlo</Label>
              <ol className="mt-3 space-y-4">
                {steps.slice(0, 7).map((s, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="num w-6 shrink-0 text-glow font-bold text-lg leading-snug">{i + 1}</span>
                    <span className="text-[15.5px] leading-relaxed text-[#d8d8dc]">{s}</span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {mistakes.length > 0 && (
            <>
              <Label className="mt-10">Errores que evitar</Label>
              <ul className="mt-3 space-y-3.5">
                {mistakes.slice(0, 4).map((x, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><Icon name="x" size={18} className="shrink-0 mt-0.5 text-danger" /><span><span className="text-white font-semibold">{x.m}</span> <span className="text-mute">{x.c}</span></span></li>
                ))}
              </ul>
            </>
          )}

          {(cues.length > 0 || lib?.breathing) && (
            <>
              <Label className="mt-10">Consejos</Label>
              <ul className="mt-3 space-y-2.5">
                {cues.slice(0, 4).map((t, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-mute"><Icon name="info" size={18} className="shrink-0 mt-0.5 text-dim" />{t}</li>
                ))}
                {lib?.breathing && <li className="flex gap-3 text-[15px] leading-relaxed text-mute"><Icon name="info" size={18} className="shrink-0 mt-0.5 text-dim" /><span><span className="text-white font-semibold">Respiración:</span> {lib.breathing}</span></li>}
              </ul>
            </>
          )}
          {lib && <p className="text-[11.5px] text-dim leading-snug mt-10">{lib.img ? 'Ilustraciones: RepDB (repdb.co). ' : lib.y ? 'Fotos: Free Exercise DB. ' : ''}Texto: Kinetic.place (MIT).</p>}
        </div>
      </div>
      <HowToSheet id={id} name={name!} lib={lib ?? null} steps={steps} open={howTo} onClose={() => setHowTo(false)} />
    </div>
  )
}
