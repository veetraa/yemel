import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { dateKey } from '../lib/utils'
import { DISCIPLINES, INTENSITY_LABEL, INTENSITY_RPE, SKILLS, TECHNIQUES, buildCombatActivity, hasCombatSport, isCombatSport, rpeToIntensity } from '../services/combatService'
import { slotFor } from '../services/planningService'
import { weekdayIndex } from '../lib/utils'
import type { CombatDiscipline, Intensity } from '../types'
import { MultiChips, NumInput, SubLabel, TextInput } from './fields'
import { Button, Label, Sheet, Toggle } from './ui'

const RPE_HINT: Record<number, string> = { 1: 'Muy suave', 3: 'Suave', 5: 'Moderado', 7: 'Duro', 9: 'Muy duro', 10: 'Máximo' }

/**
 * Registro de una sesión de combate (o de otra actividad fuera del gimnasio).
 * No asume intensidad: hay que indicar intensidad o RPE.
 */
export function CombatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, plan, addActivity, showToast } = useStore()
  const today = slotFor(plan, weekdayIndex())
  const planned = today?.type === 'combat' ? today.combat : undefined
  const sports = useMemo(() => {
    const s = profile.sports.filter((x) => x !== 'Gimnasio')
    return s.length ? s : [profile.primaryDiscipline ?? 'MMA']
  }, [profile.sports, profile.primaryDiscipline])
  const [sport, setSport] = useState<string | undefined>()
  const chosen = sport ?? (hasCombatSport(sports) ? sports.find(isCombatSport) : sports[0]) ?? 'MMA'
  const combat = isCombatSport(chosen)

  const [disciplines, setDisciplines] = useState<CombatDiscipline[] | undefined>()
  const [techniques, setTechniques] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [minutes, setMinutes] = useState<number | undefined>()
  const [intensity, setIntensity] = useState<Intensity | undefined>()
  const [rpe, setRpe] = useState<number | undefined>()
  const [sparring, setSparring] = useState<boolean | undefined>()
  const [rounds, setRounds] = useState<number | undefined>()
  const [note, setNote] = useState('')
  const [date, setDate] = useState(dateKey())
  const [custom, setCustom] = useState('')

  const ds = disciplines ?? planned?.disciplines ?? []
  const mins = minutes ?? planned?.minutes ?? profile.combatMinutes
  // El sparring realizado nunca se prefija desde el plan: solo cuenta lo que ocurrió
  const sp = sparring ?? false
  const techOptions = [...new Set(ds.flatMap((d) => TECHNIQUES[d]))]

  const reset = () => { setDisciplines(undefined); setTechniques([]); setSkills([]); setMinutes(undefined); setIntensity(undefined); setRpe(undefined); setSparring(undefined); setRounds(undefined); setNote(''); setCustom('') }

  const save = () => {
    const ts = Math.min(new Date(`${date}T12:00:00`).getTime(), Date.now())
    const r = buildCombatActivity({
      sport: chosen, minutes: mins, rpe, intensity, disciplines: combat ? ds : [], techniques: combat ? techniques : [], skills: combat ? skills : [],
      sparring: combat && sp, sparringRounds: rounds, note, ts,
    })
    if (!r.activity) return showToast(r.error!)
    addActivity(combat ? r.activity : { ...r.activity, kind: 'other' })
    showToast(`${chosen} registrado`)
    reset(); onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Registrar sesión">
      <p className="text-[13.5px] text-mute leading-relaxed">Suma a tu carga semanal junto al gimnasio. Registra lo que realmente hiciste: una sesión técnica no es un sparring.</p>
      <div className="mt-5 space-y-5">
        {sports.length > 1 && <MultiChips single options={sports} value={[chosen]} onChange={(v) => setSport(v[0] ?? chosen)} />}
        {combat && (
          <>
            <div><SubLabel>Disciplinas trabajadas</SubLabel><MultiChips options={DISCIPLINES} value={ds} onChange={(v) => setDisciplines(v as CombatDiscipline[])} /></div>
            {techOptions.length > 0 && (
              <div><SubLabel>Técnica practicada</SubLabel>
                <MultiChips options={techOptions} value={techniques} onChange={setTechniques} />
                <div className="flex gap-2 mt-2">
                  <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Otra técnica…" aria-label="Otra técnica" className="flex-1 bg-s2 rounded-xl h-10 px-3 text-[15px]" />
                  <Button variant="secondary" size="sm" disabled={!custom.trim()} onClick={() => { setTechniques([...techniques, custom.trim()]); setCustom('') }}>Añadir</Button>
                </div>
              </div>
            )}
            <div><SubLabel>Habilidades trabajadas</SubLabel><MultiChips options={SKILLS} value={skills} onChange={setSkills} /></div>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="Duración" unit="min" value={mins} onChange={setMinutes} max={600} />
          <TextInput label="Fecha" type="date" value={date} onChange={(v) => setDate(v || dateKey())} />
        </div>
        <div>
          <SubLabel>Intensidad</SubLabel>
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'moderate', 'hard'] as Intensity[]).map((i) => (
              <button key={i} aria-pressed={intensity === i} onClick={() => { setIntensity(i); setRpe(INTENSITY_RPE[i]) }} className={`h-11 rounded-xl text-[14px] font-semibold ${intensity === i ? 'bg-white text-black' : 'bg-s2 text-mute'}`}>{INTENSITY_LABEL[i]}</button>
            ))}
          </div>
          <div className="flex justify-between items-baseline mt-4"><Label>RPE (esfuerzo percibido)</Label><span className="text-[12px] text-mute">{rpe ? RPE_HINT[rpe] ?? '' : 'sin indicar'}</span></div>
          <div className="grid grid-cols-10 gap-1 mt-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} aria-label={`RPE ${n}`} aria-pressed={rpe === n} onClick={() => { setRpe(n); setIntensity(rpeToIntensity(n)) }} className={`h-11 rounded-lg num text-[14px] font-bold ${rpe === n ? 'bg-accent text-black' : rpe && n < rpe ? 'bg-s3 text-white' : 'bg-s2 text-mute'}`}>{n}</button>
            ))}
          </div>
        </div>
        {combat && (
          <div className="bg-s1 rounded-2xl p-4 space-y-3">
            <div className="flex items-center"><div className="flex-1"><div className="font-semibold">Sparring realizado</div><div className="text-[12.5px] text-mute">Cuenta como sesión exigente para tus piernas</div></div><Toggle on={sp} onChange={setSparring} /></div>
            {sp && <NumInput label="Rondas" value={rounds} max={30} onChange={setRounds} />}
          </div>
        )}
        <TextInput label="Observaciones personales" value={note} onChange={setNote} placeholder="Sensaciones, errores a corregir…" />
        <Button className="w-full" onClick={save}>GUARDAR SESIÓN</Button>
      </div>
    </Sheet>
  )
}
