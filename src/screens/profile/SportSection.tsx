import { useState } from 'react'
import { ActivitySheet } from '../../components/ActivitySheet'
import { MultiChips, NumInput, Seg, SubLabel, WeekdayChips } from '../../components/fields'
import { Button } from '../../components/ui'
import { EQUIPMENT, MAIN_GOALS, SECONDARY_GOALS, SPORTS } from '../../lib/profile'
import { useStore } from '../../store'
import type { Experience } from '../../types'

const months = (m?: number) => (m === undefined ? '' : m >= 12 ? `${Math.floor(m / 12)} a${m % 12 ? ` ${m % 12} m` : ''}` : `${m} m`)

export function SportSection() {
  const { profile: p, updateProfile } = useStore()
  const [sheet, setSheet] = useState(false)
  const bjj = p.sports.includes('Jiu-Jitsu')
  return (
    <>
      <div><SubLabel>Objetivo principal</SubLabel><MultiChips single options={MAIN_GOALS} value={p.mainGoal ? [p.mainGoal] : []} onChange={(v) => updateProfile({ mainGoal: v[0] })} /></div>
      <div><SubLabel>Objetivos secundarios</SubLabel><MultiChips options={SECONDARY_GOALS} value={p.secondaryGoals} onChange={(v) => updateProfile({ secondaryGoals: v })} /></div>
      <div><SubLabel>Nivel de experiencia</SubLabel>
        <Seg<Experience> value={p.experience} onChange={(v) => updateProfile({ experience: v })} options={[{ v: 'beginner', l: 'Principiante' }, { v: 'intermediate', l: 'Intermedio' }, { v: 'advanced', l: 'Avanzado' }]} />
        <p className="text-[12px] text-dim mt-2 leading-snug">Afina las cargas iniciales sugeridas.{!p.experience && ' Sin indicar: se asume intermedio.'}</p></div>
      <NumInput label="Tiempo entrenando" unit="meses" value={p.trainingMonths} max={900} onChange={(n) => updateProfile({ trainingMonths: n })} hint={p.trainingMonths ? `≈ ${months(p.trainingMonths)}` : undefined} />
      <div><SubLabel>Deportes que practicas</SubLabel><MultiChips options={SPORTS} value={p.sports} onChange={(v) => updateProfile({ sports: v })} /></div>

      {bjj && (
        <div className="bg-s1 rounded-2xl p-4 space-y-4">
          <div className="font-bold">Jiu-Jitsu</div>
          <div><SubLabel>Días de clase</SubLabel><WeekdayChips value={p.bjjDays} onChange={(v) => updateProfile({ bjjDays: v })} /></div>
          <NumInput label="Duración habitual" unit="min" value={p.bjjMinutes} max={300} onChange={(n) => updateProfile({ bjjMinutes: n })} />
          <Button variant="secondary" size="md" className="w-full" onClick={() => setSheet(true)}>Registrar sesión de Jiu-Jitsu</Button>
          <p className="text-[12px] text-dim leading-snug">El entrenador evita programar gimnasio pesado sobre tus días de clase y suma el Jiu-Jitsu a tu carga semanal.</p>
        </div>
      )}

      <div><SubLabel>Sesiones de gimnasio por semana</SubLabel>
        <div className="flex items-center bg-s2 rounded-xl h-12">
          <button className="w-14 h-full grid place-items-center text-mute text-xl" aria-label="Menos sesiones" onClick={() => updateProfile({ weeklyGoal: Math.max(1, p.weeklyGoal - 1) })}>−</button>
          <div className="flex-1 text-center num font-bold">{p.weeklyGoal} <span className="text-mute text-xs font-semibold">días</span></div>
          <button className="w-14 h-full grid place-items-center text-mute text-xl" aria-label="Más sesiones" onClick={() => updateProfile({ weeklyGoal: Math.min(7, p.weeklyGoal + 1) })}>+</button>
        </div></div>
      <div><SubLabel>Días disponibles para entrenar</SubLabel><WeekdayChips value={p.availableDays} onChange={(v) => updateProfile({ availableDays: v })} mark={bjj ? p.bjjDays : undefined} />
        {!p.availableDays.length && <p className="text-[12px] text-dim mt-2">Sin indicar: se consideran todos los días.</p>}</div>
      <div><SubLabel>Duración de las sesiones</SubLabel>
        <div className="flex gap-2 flex-wrap">
          {[30, 45, 60, 75, 90].map((m) => (
            <button key={m} onClick={() => updateProfile({ sessionMinutes: p.sessionMinutes === m ? undefined : m })} aria-pressed={p.sessionMinutes === m} className={`h-10 px-4 rounded-full text-sm font-bold num ${p.sessionMinutes === m ? 'bg-white text-black' : 'bg-s2 text-mute'}`}>{m} min</button>
          ))}
        </div>
        <p className="text-[12px] text-dim mt-2 leading-snug">Si una rutina dura más, podrás acortarla automáticamente al empezar.</p></div>
      <div><SubLabel>Equipamiento disponible</SubLabel><MultiChips options={EQUIPMENT} value={p.equipment} onChange={(v) => updateProfile({ equipment: v })} /></div>
      <ActivitySheet open={sheet} onClose={() => setSheet(false)} />
    </>
  )
}
