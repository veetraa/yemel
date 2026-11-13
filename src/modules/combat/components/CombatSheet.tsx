import { useMemo, useState } from 'react'
import { MultiChips, NumInput, SubLabel, TextInput } from '../../../shared/components/fields'
import { Button, Label, Sheet, Toggle } from '../../../shared/components/ui'
import { dateKey, weekdayIndex } from '../../../shared/lib/utils'
import { slotFor } from '../../../shared/services/planningService'
import { useStore } from '../../../store'
import type { CombatDiscipline, CombatSport, Intensity } from '../../../types'
import { libraryOf, SPORT_SHORT } from '../services/combatLibraryService'
import { COMBAT_SECTIONS, DISCIPLINES, INTENSITY_LABEL, INTENSITY_RPE, SKILLS, buildCombatActivity, rpeToIntensity } from '../services/combatService'

const RPE_HINT: Record<number, string> = { 1: 'Muy suave', 3: 'Suave', 5: 'Moderado', 7: 'Duro', 9: 'Muy duro', 10: 'Máximo' }

export interface CombatPreset { sport?: CombatSport; minutes?: number; techniques?: string[]; areas?: CombatDiscipline[] }

/**
 * Registro de una sesión de combate de una disciplina de COMBAT.
 * No asume intensidad: hay que indicar intensidad o RPE. El sparring realizado nunca se prefija.
 */
export function CombatSheet({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: CombatPreset }) {
  const { profile, plan, addActivity, showToast } = useStore()
  const today = slotFor(plan, weekdayIndex())
  const planned = today?.type === 'combat' ? today.combat : undefined
  const primary = (COMBAT_SECTIONS as string[]).includes(profile.primaryDiscipline ?? '') ? (profile.primaryDiscipline as CombatSport) : 'MMA'
  const [sport, setSport] = useState<CombatSport | undefined>()
  const chosen = sport ?? preset?.sport ?? ((COMBAT_SECTIONS as string[]).includes(planned?.sport ?? '') ? (planned!.sport as CombatSport) : primary)

  const [areas, setAreas] = useState<CombatDiscipline[] | undefined>()
  const [techniques, setTechniques] = useState<string[] | undefined>()
  const [skills, setSkills] = useState<string[]>([])
  const [minutes, setMinutes] = useState<number | undefined>()
  const [intensity, setIntensity] = useState<Intensity | undefined>()
  const [rpe, setRpe] = useState<number | undefined>()
  const [sparring, setSparring] = useState(false)
  const [rounds, setRounds] = useState<number | undefined>()
  const [note, setNote] = useState('')
  const [date, setDate] = useState(dateKey())
  const [custom, setCustom] = useState('')

  const ar = areas ?? preset?.areas ?? planned?.disciplines ?? []
  const tech = techniques ?? preset?.techniques ?? []
  const mins = minutes ?? preset?.minutes ?? planned?.minutes ?? profile.combatMinutes
  const techOptions = useMemo(() => libraryOf(chosen).techniques.map((t) => t.name), [chosen])

  const reset = () => { setSport(undefined); setAreas(undefined); setTechniques(undefined); setSkills([]); setMinutes(undefined); setIntensity(undefined); setRpe(undefined); setSparring(false); setRounds(undefined); setNote(''); setCustom('') }

  const save = () => {
    const ts = Math.min(new Date(`${date}T12:00:00`).getTime(), Date.now())
    const r = buildCombatActivity({ sport: chosen, minutes: mins, rpe, intensity, disciplines: chosen === 'MMA' ? ar : [], techniques: tech, skills, sparring, sparringRounds: rounds, note, ts })
    if (!r.activity) return showToast(r.error!)
    addActivity(r.activity)
    showToast(`${SPORT_SHORT[chosen]} registrado`)
    reset(); onClose()
  }

  return (
    <Sheet open={open} onClose={() => { onClose() }} title="Registrar sesión de combate">
      <p className="text-[13.5px] text-mute leading-relaxed">Suma a tu carga semanal. Registra lo que realmente hiciste: una sesión técnica no es un sparring.</p>
      <div className="mt-5 space-y-5">
        <div><SubLabel>Disciplina</SubLabel><MultiChips single options={COMBAT_SECTIONS.map(String)} value={[chosen]} onChange={(v) => { setSport((v[0] as CombatSport) ?? chosen); setTechniques(undefined) }} /></div>
        {chosen === 'MMA' && <div><SubLabel>Áreas trabajadas</SubLabel><MultiChips options={DISCIPLINES} value={ar} onChange={(v) => setAreas(v as CombatDiscipline[])} /></div>}
        <div><SubLabel>Técnica practicada</SubLabel>
          <MultiChips options={techOptions} value={tech} onChange={setTechniques} />
          <div className="flex gap-2 mt-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Otra técnica…" aria-label="Otra técnica" className="flex-1 bg-s2 rounded-xl h-10 px-3 text-[15px]" />
            <Button variant="secondary" size="sm" disabled={!custom.trim()} onClick={() => { setTechniques([...tech, custom.trim()]); setCustom('') }}>Añadir</Button>
          </div>
        </div>
        <div><SubLabel>Habilidades trabajadas</SubLabel><MultiChips options={SKILLS} value={skills} onChange={setSkills} /></div>
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
        <div className="bg-s1 rounded-2xl p-4 space-y-3">
          <div className="flex items-center"><div className="flex-1"><div className="font-semibold">Sparring realizado</div><div className="text-[12.5px] text-mute">Cuenta como sesión exigente para tus piernas</div></div><Toggle on={sparring} onChange={setSparring} /></div>
          {sparring && <NumInput label="Rondas" value={rounds} max={30} onChange={setRounds} />}
        </div>
        <TextInput label="Observaciones personales" value={note} onChange={setNote} placeholder="Sensaciones, errores a corregir…" />
        <Button className="w-full" onClick={save}>GUARDAR SESIÓN</Button>
      </div>
    </Sheet>
  )
}
