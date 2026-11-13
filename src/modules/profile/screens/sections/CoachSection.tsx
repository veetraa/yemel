import { useState } from 'react'
import { Icon } from '../../../../shared/components/Icon'
import { Button, Label, Row, Toggle } from '../../../../shared/components/ui'
import { loadStatus } from '../../../../shared/services/fatigueService'
import { PRINCIPLES, principleFor } from '../../../../shared/services/principlesService'
import { scheduleNotes, validatePlan } from '../../../../shared/services/planningService'
import { currentWeight } from '../../../../shared/services/profileService'
import { deloadStatus, readiness } from '../../../../shared/services/recoveryService'
import { combatSummary } from '../../../combat/services/combatService'
import { formatDateShort, formatNumber } from '../../../../shared/lib/utils'
import { useNav } from '../../../../nav'
import { useStore } from '../../../../store'

const LOAD_TXT = {
  unknown: 'Aún no hay suficiente historial (necesito al menos 2 semanas previas con actividad).',
  low: 'Carga baja respecto a tu media reciente.',
  ok: 'Carga dentro de tu rango habitual.',
  elevated: 'Carga elevada respecto a tu media.',
  high: 'Carga muy alta respecto a tu media: conviene recortar volumen.',
} as const
const READY_TXT = { good: 'Buena', moderate: 'Media', low: 'Baja', unknown: 'Sin registro de hoy/ayer' } as const

export function CoachSection() {
  const { ctx, profile, sessions, activities, wellness, body, planRoutine, plan, settings, updateSettings, adjustment, deloadAction } = useStore()
  const { go } = useNav()
  const [why, setWhy] = useState(false)
  const r = readiness(wellness)
  const l = loadStatus(sessions, activities)
  const dl = deloadStatus(ctx)
  const cs = combatSummary(activities, 30)
  const notes = [...(planRoutine ? scheduleNotes(profile, planRoutine.days, plan) : []), ...validatePlan(plan, profile, planRoutine).filter((i) => i.level !== 'info').map((i) => i.message)]
  const used: [string, boolean][] = [
    ['Peso corporal actual', currentWeight(profile, body) !== undefined],
    ['Nivel de experiencia', !!profile.experience],
    ['Objetivo principal', !!profile.mainGoal],
    ['Semana de entrenamiento y combate', plan.slots.length > 0],
    ['Días disponibles', profile.availableDays.length > 0],
    ['Duración de sesión', !!profile.sessionMinutes],
    ['Recuperación de hoy/ayer', r.level !== 'unknown'],
  ]
  return (
    <>
      <div className="bg-s1 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between"><Label>Recuperación</Label><span className={`text-[13px] font-bold ${r.level === 'low' ? 'text-danger' : r.level === 'moderate' ? 'text-[#ffb340]' : r.level === 'good' ? 'text-glow' : 'text-mute'}`}>{READY_TXT[r.level]}</span></div>
        {r.reasons.length > 0 && <p className="text-[13.5px] text-mute leading-snug">{r.reasons.join(' · ')}</p>}
        <div className="h-px bg-line" />
        <div className="flex items-center justify-between"><Label>Carga interna semanal</Label>{l.ratio !== undefined && <span className="num text-[13px] font-bold">×{formatNumber(l.ratio, 2)}</span>}</div>
        <p className="text-[13.5px] text-mute leading-snug">{LOAD_TXT[l.level]}</p>
        <p className="text-[11.5px] text-dim leading-snug">Carga = minutos × RPE de gimnasio, combate y recuperación. Sin RPE: 6 en gimnasio. Combate: lo que registres.</p>
      </div>

      <div className="bg-s1 rounded-2xl p-4">
        <Label>Semana de descarga</Label>
        <p className="text-[14px] mt-2 leading-snug">
          {dl.state === 'active' ? `Activa hasta el ${formatDateShort(dl.endsAt!)}.` : dl.state === 'suggested' ? `Sugerida: ${dl.reasons.join('. ')}.` : dl.state === 'due-fine' ? `Han pasado ${dl.weeksSince} semanas, pero tu recuperación va bien: es opcional.` : dl.state === 'snoozed' ? 'Pospuesta unos días.' : `Se valorará cada ${dl.every} semanas${dl.weeksSince !== undefined ? ` (llevas ${dl.weeksSince})` : ''}.`}
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          {dl.state === 'active' ? <Button size="sm" variant="secondary" onClick={() => deloadAction('end')}>Terminar descarga</Button> : <Button size="sm" variant={dl.state === 'suggested' ? 'primary' : 'secondary'} onClick={() => deloadAction('start')}>Iniciar descarga ahora</Button>}
          {(dl.state === 'suggested' || dl.state === 'due-fine') && <Button size="sm" variant="ghost" onClick={() => deloadAction('snooze')}>Más adelante</Button>}
        </div>
      </div>

      <div>
        <Label>Ajuste actual del entrenamiento</Label>
        {adjustment.active || adjustment.notes.length ? (
          <ul className="mt-2 space-y-2.5">{adjustment.notes.map((n, i) => <li key={i} className="flex gap-2.5 text-[14px] leading-snug"><Icon name="info" size={17} className="shrink-0 mt-0.5 text-glow" />{n}</li>)}</ul>
        ) : <p className="text-[14px] text-mute mt-2 leading-relaxed">Sin ajustes: tus datos no indican motivo para modificar el plan.</p>}
        {adjustment.codes.length > 0 && (
          <>
            <button onClick={() => setWhy(!why)} className="text-[12.5px] font-semibold text-glow mt-3">{why ? 'Ocultar' : '¿Por qué?'}</button>
            {why && <ul className="mt-2 space-y-2">{[...new Set(adjustment.codes.map((c) => principleFor(c).id))].map((id) => { const p = PRINCIPLES.find((x) => x.id === id)!; return <li key={id} className="text-[13px] leading-snug text-mute"><b className="text-white">{p.title}.</b> {p.text}</li> })}</ul>}
          </>
        )}
      </div>

      {notes.length > 0 && <div><Label>Agenda</Label><ul className="mt-2 space-y-2">{notes.map((n, i) => <li key={i} className="text-[14px] text-mute leading-snug">• {n}</li>)}</ul></div>}

      <Row><div className="flex-1"><div className="font-semibold">Adaptar a mi recuperación</div><div className="text-[12.5px] text-mute">Reduce series y carga cuando tus datos lo aconsejan</div></div><Toggle on={settings.adaptToRecovery} onChange={(v) => updateSettings({ adaptToRecovery: v })} /></Row>

      <div>
        <Label>Datos que usa el entrenador</Label>
        <ul className="mt-2 grid grid-cols-1 gap-1.5">{used.map(([t, ok]) => <li key={t} className="flex items-center gap-2.5 text-[14px]"><span className={`w-5 h-5 rounded-full grid place-items-center ${ok ? 'bg-accent text-black' : 'bg-s3 text-dim'}`}>{ok ? <Icon name="check" size={12} stroke={3.4} /> : <span className="text-[10px] font-bold">—</span>}</span><span className={ok ? '' : 'text-mute'}>{t}{ok ? '' : ' · sin indicar'}</span></li>)}</ul>
      </div>

      <div>
        <div className="flex items-center justify-between"><Label>Combate · 30 días (solo lectura)</Label><button onClick={() => go('combat', 'overview')} className="text-[13px] font-semibold text-glow">Ir a Combat</button></div>
        {cs.sessions ? <p className="text-[13.5px] text-mute mt-2">{cs.sessions} sesiones · {cs.minutes} min · RPE medio {formatNumber(cs.avgRpe ?? 0)} · {cs.sparringSessions} con sparring</p> : <p className="text-[14px] text-mute mt-2">Sin sesiones de combate registradas.</p>}
        <p className="text-[11.5px] text-dim mt-1.5 leading-snug">Las sesiones se registran y se borran en Combat; aquí solo se usan para calcular tu carga global.</p>
      </div>

      <div>
        <Label>Principios del entrenador</Label>
        <ul className="mt-3 space-y-3">{PRINCIPLES.map((p) => <li key={p.id}><div className="font-semibold text-[14.5px]">{p.title}</div><div className="text-[13px] text-mute leading-snug mt-0.5">{p.text}</div></li>)}</ul>
      </div>
    </>
  )
}
