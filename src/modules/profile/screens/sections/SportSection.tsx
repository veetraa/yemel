import { MultiChips, NumInput, Seg, SubLabel, TextInput, WeekdayChips } from '../../../../shared/components/fields'
import { Button, Toggle } from '../../../../shared/components/ui'
import { EQUIPMENT, MAIN_GOALS, SECONDARY_GOALS, SPORTS } from '../../../../shared/services/profileService'
import { hasCombatSport } from '../../../combat/services/combatService'
import { combatDays } from '../../../../shared/services/planningService'
import { deloadEvery } from '../../../../shared/services/recoveryService'
import { T } from '../../../../shared/services/principlesService'
import { useNav } from '../../../../nav'
import { useStore } from '../../../../store'
import type { Experience } from '../../../../types'

const months = (m?: number) => (m === undefined ? '' : m >= 12 ? `${Math.floor(m / 12)} a${m % 12 ? ` ${m % 12} m` : ''}` : `${m} m`)
const PRIMARY = ['MMA', 'Boxeo', 'Kickboxing', 'Wrestling', 'Brazilian Jiu-Jitsu', 'Grappling']

function Stepper({ label, value, onChange, min, max, unit }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; unit: string }) {
  return (
    <div><SubLabel>{label}</SubLabel>
      <div className="flex items-center bg-s2 rounded-xl h-12">
        <button className="w-14 h-full grid place-items-center text-mute text-xl" aria-label={`Menos ${label}`} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <div className="flex-1 text-center num font-bold">{value} <span className="text-mute text-xs font-semibold">{unit}</span></div>
        <button className="w-14 h-full grid place-items-center text-mute text-xl" aria-label={`Más ${label}`} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  )
}

export function SportSection() {
  const { profile: p, updateProfile, plan } = useStore()
  const { push, go } = useNav()
  const combat = hasCombatSport(p.sports)
  return (
    <>
      <div className="bg-s1 rounded-2xl p-4 space-y-4">
        <TextInput label="Tipo de atleta" value={p.athleteType ?? ''} onChange={(v) => updateProfile({ athleteType: v || undefined })} placeholder="Balanced Hybrid Athlete" />
        <div><SubLabel>Disciplina principal</SubLabel><MultiChips single options={PRIMARY} value={p.primaryDiscipline ? [p.primaryDiscipline] : []} onChange={(v) => updateProfile({ primaryDiscipline: v[0] })} /></div>
        <Stepper label="Sesiones de gimnasio" value={p.weeklyGoal} min={1} max={7} unit="por semana" onChange={(n) => updateProfile({ weeklyGoal: n })} />
        <Stepper label="Sesiones de deportes de contacto" value={p.contactSessionsPerWeek ?? 0} min={0} max={7} unit="por semana" onChange={(n) => updateProfile({ contactSessionsPerWeek: n })} />
        <Stepper label="Días de recuperación" value={p.recoveryDaysPerWeek ?? T.MIN_RECOVERY_DAYS} min={1} max={5} unit="por semana" onChange={(n) => updateProfile({ recoveryDaysPerWeek: n })} />
        <div className="flex items-center"><div className="flex-1"><div className="font-semibold">Preparación física integrada</div><div className="text-[12.5px] text-mute">Se trabaja dentro de las sesiones de gimnasio</div></div><Toggle on={!!p.conditioningIntegrated} onChange={(v) => updateProfile({ conditioningIntegrated: v })} /></div>
        <div><SubLabel>Descarga sugerida cada</SubLabel>
          <Seg<number> value={deloadEvery(p)} onChange={(v) => updateProfile({ deloadEveryWeeks: v })} options={[4, 5, 6].map((v) => ({ v, l: `${v} sem.` }))} />
          <p className="text-[12px] text-dim mt-2 leading-snug">Solo se sugiere si tu recuperación, carga o progreso lo justifican. Nunca se impone.</p></div>
        <Button variant="secondary" size="md" className="w-full" onClick={() => push({ name: 'shared.week' })}>Ver semana y recuperación</Button>
      </div>

      <div><SubLabel>Objetivo principal</SubLabel><MultiChips single options={MAIN_GOALS} value={p.mainGoal ? [p.mainGoal] : []} onChange={(v) => updateProfile({ mainGoal: v[0] })} /></div>
      <div><SubLabel>Objetivos secundarios</SubLabel><MultiChips options={SECONDARY_GOALS} value={p.secondaryGoals} onChange={(v) => updateProfile({ secondaryGoals: v })} /></div>
      <div><SubLabel>Nivel de experiencia</SubLabel>
        <Seg<Experience> value={p.experience} onChange={(v) => updateProfile({ experience: v })} options={[{ v: 'beginner', l: 'Principiante' }, { v: 'intermediate', l: 'Intermedio' }, { v: 'advanced', l: 'Avanzado' }]} />
        <p className="text-[12px] text-dim mt-2 leading-snug">Ajusta series, repeticiones y cargas iniciales.{!p.experience && ' Sin indicar: se asume intermedio.'}</p></div>
      <NumInput label="Tiempo entrenando" unit="meses" value={p.trainingMonths} max={900} onChange={(n) => updateProfile({ trainingMonths: n })} hint={p.trainingMonths ? `≈ ${months(p.trainingMonths)}` : undefined} />
      <div><SubLabel>Deportes que practicas</SubLabel><MultiChips options={SPORTS} value={p.sports} onChange={(v) => updateProfile({ sports: v })} /></div>
      {combat && (
        <div className="bg-s1 rounded-2xl p-4 space-y-4">
          <div className="font-bold">Combate</div>
          <NumInput label="Duración habitual de una sesión" unit="min" value={p.combatMinutes} max={300} onChange={(n) => updateProfile({ combatMinutes: n })} />
          <Button variant="secondary" size="md" className="w-full" onClick={() => go('combat', 'overview')}>Abrir Combat</Button>
          <p className="text-[12px] text-dim leading-snug">Las sesiones se registran y se editan en Combat. El entrenador modera las piernas antes y después de sesiones exigentes.</p>
        </div>
      )}
      <div><SubLabel>Días disponibles para entrenar</SubLabel><WeekdayChips value={p.availableDays} onChange={(v) => updateProfile({ availableDays: v })} mark={combatDays(plan)} />
        {!p.availableDays.length && <p className="text-[12px] text-dim mt-2">Sin indicar: se consideran todos los días. «JJ» marca tus días de combate.</p>}</div>
      <div><SubLabel>Duración de las sesiones de gimnasio</SubLabel>
        <div className="flex gap-2 flex-wrap">
          {[30, 45, 60, 75, 90].map((m) => (
            <button key={m} onClick={() => updateProfile({ sessionMinutes: p.sessionMinutes === m ? undefined : m })} aria-pressed={p.sessionMinutes === m} className={`h-10 px-4 rounded-full text-sm font-bold num ${p.sessionMinutes === m ? 'bg-white text-black' : 'bg-s2 text-mute'}`}>{m} min</button>
          ))}
        </div>
        <p className="text-[12px] text-dim mt-2 leading-snug">Si una rutina dura más, podrás acortarla automáticamente al empezar.</p></div>
      <div><SubLabel>Equipamiento disponible</SubLabel><MultiChips options={EQUIPMENT} value={p.equipment} onChange={(v) => updateProfile({ equipment: v })} /></div>
    </>
  )
}
