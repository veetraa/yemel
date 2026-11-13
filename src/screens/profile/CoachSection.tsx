import { useState } from 'react'
import { ActivitySheet } from '../../components/ActivitySheet'
import { Icon } from '../../components/Icon'
import { Button, Label, Row, Toggle } from '../../components/ui'
import { loadStatus, readiness, scheduleNotes } from '../../lib/coach'
import { activeRoutine } from '../../lib/plan'
import { currentWeight } from '../../lib/profile'
import { formatDateShort, formatNumber } from '../../lib/utils'
import { useStore } from '../../store'

const LOAD_TXT = {
  unknown: 'Aún no hay suficiente historial (necesito al menos 2 semanas previas con actividad).',
  low: 'Carga baja respecto a tu media reciente.',
  ok: 'Carga dentro de tu rango habitual.',
  elevated: 'Carga elevada respecto a tu media.',
  high: 'Carga muy alta respecto a tu media: conviene recortar volumen.',
} as const
const READY_TXT = { good: 'Buena', moderate: 'Media', low: 'Baja', unknown: 'Sin registro de hoy/ayer' } as const

export function CoachSection() {
  const { profile, sessions, activities, wellness, body, routines, settings, updateSettings, adjustment, deleteActivity } = useStore()
  const [sheet, setSheet] = useState(false)
  const r = readiness(wellness)
  const l = loadStatus(sessions, activities)
  const routine = activeRoutine(routines, settings)
  const notes = routine ? scheduleNotes(profile, routine.days) : scheduleNotes(profile, [])
  const used: [string, boolean][] = [
    ['Peso corporal actual', currentWeight(profile, body) !== undefined],
    ['Nivel de experiencia', !!profile.experience],
    ['Objetivo principal', !!profile.mainGoal],
    ['Días disponibles', profile.availableDays.length > 0],
    ['Duración de sesión', !!profile.sessionMinutes],
    ['Jiu-Jitsu (días y carga)', !profile.sports.includes('Jiu-Jitsu') || profile.bjjDays.length > 0 || activities.length > 0],
    ['Recuperación de hoy/ayer', r.level !== 'unknown'],
  ]
  return (
    <>
      <div className="bg-s1 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between"><Label>Recuperación</Label><span className={`text-[13px] font-bold ${r.level === 'low' ? 'text-danger' : r.level === 'moderate' ? 'text-[#ffb340]' : r.level === 'good' ? 'text-accent' : 'text-mute'}`}>{READY_TXT[r.level]}</span></div>
        {r.reasons.length > 0 && <p className="text-[13.5px] text-mute leading-snug">{r.reasons.join(' · ')}</p>}
        <div className="h-px bg-line" />
        <div className="flex items-center justify-between"><Label>Carga semanal</Label>{l.ratio !== undefined && <span className="num text-[13px] font-bold">×{formatNumber(l.ratio, 2)}</span>}</div>
        <p className="text-[13.5px] text-mute leading-snug">{LOAD_TXT[l.level]}</p>
        <p className="text-[11.5px] text-dim leading-snug">Carga = minutos × esfuerzo (RPE) del gimnasio y otras actividades. Sin RPE se asume 6.</p>
      </div>

      <div>
        <Label>Ajuste actual del entrenamiento</Label>
        {adjustment.active || adjustment.notes.length ? (
          <ul className="mt-2 space-y-2">{adjustment.notes.map((n, i) => <li key={i} className="flex gap-2.5 text-[14px] leading-snug"><Icon name="info" size={17} className="shrink-0 mt-0.5 text-accent" />{n}</li>)}</ul>
        ) : <p className="text-[14px] text-mute mt-2 leading-relaxed">Sin ajustes: tus datos no indican motivo para modificar el plan.</p>}
      </div>

      {notes.length > 0 && <div><Label>Agenda</Label><ul className="mt-2 space-y-2">{notes.map((n, i) => <li key={i} className="text-[14px] text-mute leading-snug">• {n}</li>)}</ul></div>}

      <Row><div className="flex-1"><div className="font-semibold">Adaptar a mi recuperación</div><div className="text-[12.5px] text-mute">Reduce series y carga cuando tus datos lo aconsejan</div></div><Toggle on={settings.adaptToRecovery} onChange={(v) => updateSettings({ adaptToRecovery: v })} /></Row>

      <div>
        <Label>Datos que usa el entrenador</Label>
        <ul className="mt-2 grid grid-cols-1 gap-1.5">{used.map(([t, ok]) => <li key={t} className="flex items-center gap-2.5 text-[14px]"><span className={`w-5 h-5 rounded-full grid place-items-center ${ok ? 'bg-accent text-black' : 'bg-s3 text-dim'}`}>{ok ? <Icon name="check" size={12} stroke={3.4} /> : <span className="text-[10px] font-bold">—</span>}</span><span className={ok ? '' : 'text-mute'}>{t}{ok ? '' : ' · sin indicar'}</span></li>)}</ul>
      </div>

      <div>
        <div className="flex items-center justify-between"><Label>Actividad fuera del gimnasio</Label><button onClick={() => setSheet(true)} className="text-[13px] font-semibold text-accent">+ Registrar</button></div>
        {activities.length ? activities.slice(0, 5).map((a) => (
          <div key={a.id} className="flex items-center gap-3 py-3 border-b border-line/60 last:border-0">
            <div className="flex-1"><div className="font-semibold">{a.sport}</div><div className="text-[12.5px] text-mute">{formatDateShort(a.ts)} · {a.minutes} min · RPE {a.rpe}</div></div>
            <button aria-label="Eliminar actividad" onClick={() => deleteActivity(a.id)} className="w-9 h-9 grid place-items-center text-dim"><Icon name="trash" size={17} /></button>
          </div>
        )) : <p className="text-[14px] text-mute mt-2">Nada registrado todavía.</p>}
        <Button variant="secondary" size="md" className="w-full mt-3" onClick={() => setSheet(true)}>Registrar actividad</Button>
      </div>
      <ActivitySheet open={sheet} onClose={() => setSheet(false)} />
    </>
  )
}
