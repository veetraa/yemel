import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { CombatSheet } from '../components/CombatSheet'
import { Icon } from '../components/Icon'
import { Button, Label, Ring, Row, Sheet } from '../components/ui'
import { dateKey, formatDateLong, formatDateShort, formatDuration, formatNumber, greeting, startOfWeek, weekdayIndex, WEEKDAYS_SHORT } from '../lib/utils'
import { INTENSITY_LABEL, isCombat } from '../services/combatService'
import { loadBetween, sessionMinutes } from '../services/fatigueService'
import { SLOT_SHORT, gymFocus, todayPlan } from '../services/planningService'
import { deloadStatus, readiness } from '../services/recoveryService'
import { estimateMinutes, sessionDuration, sessionVolume, streakWeeks } from '../services/workoutService'
import { useNav } from '../nav'
import { useStore } from '../store'
import { RecoverySection } from './profile/RecoverySection'
import type { SlotType } from '../types'

const DAY = 86400000
const DOT: Record<SlotType, string> = { gym: 'bg-white/90 text-black', combat: 'bg-accent/90 text-black', recovery: 'bg-s3 text-white', rest: 'bg-s2 text-dim' }

export function HomeScreen() {
  const { profile, sessions, activities, wellness, plan, planRoutine, ctx, active, startWorkout, adjustment, deloadAction } = useStore()
  const { setTab, push } = useNav()
  const [checkin, setCheckin] = useState(false)
  const [combatOpen, setCombatOpen] = useState(false)
  const t = todayPlan(ctx)
  const slot = t.slot
  const deload = deloadStatus(ctx)
  const dk = dateKey()
  const todayLogged = wellness.some((w) => w.id === dk)
  const today = weekdayIndex()

  const week = useMemo(() => {
    const start = startOfWeek()
    const end = start + 7 * DAY
    const gym = sessions.filter((s) => s.endedAt >= start && s.endedAt < end)
    const acts = activities.filter((a) => a.ts >= start && a.ts < end)
    const days = Array(7).fill(false) as boolean[]
    for (const s of gym) days[Math.min(6, Math.floor((s.endedAt - start) / DAY))] = true
    for (const a of acts) days[Math.min(6, Math.floor((a.ts - start) / DAY))] = true
    const minutes = gym.reduce((a, s) => a + sessionMinutes(s), 0) + acts.reduce((a, x) => a + x.minutes, 0)
    const load = loadBetween(sessions, activities, start, end).total
    const completed = gym.length + acts.filter(isCombat).length
    return { days, minutes, load, completed }
  }, [sessions, activities])
  const planned = plan.slots.filter((s) => s.type === 'gym' || s.type === 'combat').length || profile.weeklyGoal
  const streak = streakWeeks(sessions, profile.weeklyGoal)

  const startGym = () => {
    if (!active) startWorkout(planRoutine, t.routineDay)
    setTab('train')
  }
  const cta = (() => {
    if (active) return { label: 'CONTINUAR ENTRENAMIENTO', icon: 'bolt', go: () => setTab('train') }
    if (!slot) return null
    if (slot.type === 'gym') return t.routineDay ? { label: t.done ? 'ENTRENAR DE NUEVO' : 'COMENZAR ENTRENAMIENTO', icon: 'bolt', go: startGym } : { label: 'ELEGIR ENTRENAMIENTO', icon: 'bolt', go: () => setTab('train') }
    if (slot.type === 'combat') return { label: t.done ? 'REGISTRAR OTRA SESIÓN' : 'REGISTRAR SESIÓN DE COMBATE', icon: 'plus', go: () => setCombatOpen(true) }
    if (slot.type === 'recovery') return { label: t.done ? 'REPETIR RECUPERACIÓN' : 'INICIAR RECUPERACIÓN ACTIVA', icon: 'clock', go: () => push({ name: 'mobility' }) }
    return null
  })()
  const kicker = active ? 'En curso' : t.done ? 'Completado hoy' : slot ? { gym: 'Hoy · Gimnasio', combat: 'Hoy · Combate', recovery: 'Hoy · Recuperación', rest: 'Hoy · Descanso' }[slot.type] : 'Hoy'
  const r = readiness(wellness)

  return (
    <div className="scroll h-full pb-8">
      <div className="pt-safe px-6 pt-4">
        <Label className="first-letter:uppercase">{formatDateLong()}</Label>
        <h1 className="text-[34px] leading-[1.1] font-bold tracking-tight mt-1.5">
          {greeting()}{profile.name.trim() ? <>,<br /><span className="text-mute">{profile.name.trim()}</span></> : null}
        </h1>
      </div>

      {/* Hoy */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="px-6 mt-9">
        <Label>{kicker}</Label>
        {slot ? (
          <>
            <div className="mt-2 text-[28px] font-bold leading-tight tracking-tight">{active ? active.dayName : t.routineDay && slot.type === 'gym' ? t.routineDay.name : slot.label}</div>
            <div className="text-mute mt-1 text-[15px] leading-snug">
              {slot.focus ?? ''}
              {slot.type === 'gym' && t.routineDay ? ` · ${t.routineDay.exercises.length} ejercicios · ~${estimateMinutes(t.routineDay)} min` : ''}
            </div>
            {slot.type === 'combat' && (
              <div className="flex flex-wrap gap-2 mt-3">
                {slot.intensity && <span className="text-[12px] font-semibold bg-s2 rounded-full px-3 py-1">Intensidad prevista: {INTENSITY_LABEL[slot.intensity].toLowerCase()}</span>}
                {slot.combat?.sparring && <span className="text-[12px] font-semibold text-accent border border-accent/50 rounded-full px-3 py-1">Sparring según nivel</span>}
                {slot.combat?.disciplines.map((d) => <span key={d} className="text-[12px] text-mute bg-s2 rounded-full px-3 py-1">{d}</span>)}
              </div>
            )}
            {slot.type === 'gym' && !active && (
              <div className="flex flex-wrap gap-x-2 gap-y-1 mt-3 text-[13px] text-dim">
                {gymFocus(slot, planRoutine) === 'lower' ? 'Tren inferior' : gymFocus(slot, planRoutine) === 'upper' ? 'Tren superior' : 'Cuerpo completo'}
              </div>
            )}
            {cta && <Button onClick={cta.go} className="w-full mt-6 text-[15px] tracking-[0.08em]"><Icon name={cta.icon} size={20} stroke={2.4} />{cta.label}</Button>}
            {slot.type === 'gym' && !active && !t.routineDay && <p className="text-[13px] text-dim mt-3">Este día no tiene una rutina enlazada. Edita la semana para elegirla.</p>}
            {slot.type === 'rest' && <p className="text-mute text-[14.5px] mt-3 leading-relaxed">Descanso completo: dormir bien y comer bien también es entrenar.</p>}
          </>
        ) : (
          <>
            <div className="mt-2 text-[28px] font-bold leading-tight tracking-tight">Sin plan para hoy</div>
            <Button onClick={() => push({ name: 'plan' })} variant="secondary" className="w-full mt-6">Configurar mi semana</Button>
          </>
        )}
        {t.next && (
          <button onClick={() => push({ name: 'plan' })} className="mt-5 flex items-center gap-2 text-[13px] text-mute w-full text-left">
            <Icon name="clock" size={15} /> <span><span className="text-white font-semibold">{t.next.label}</span> · {t.next.slot.label}{t.next.slot.focus ? ` — ${t.next.slot.focus}` : ''}</span>
          </button>
        )}
      </motion.section>

      {/* Estado del entrenador */}
      {(adjustment.notes.length > 0 || !todayLogged || deload.state !== 'not-due') && (
        <section className="px-6 mt-10">
          <Label>Tu entrenador</Label>
          {deload.state === 'active' && (
            <div className="mt-3 bg-s1 rounded-2xl p-4">
              <div className="font-bold">Semana de descarga activa</div>
              <p className="text-[13.5px] text-mute mt-1 leading-snug">Hasta el {formatDateShort(deload.endsAt!)}: menos series y menos carga, sin sparring duro.</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => deloadAction('end')}>Terminar descarga</Button>
            </div>
          )}
          {(deload.state === 'suggested' || deload.state === 'due-fine') && (
            <div className="mt-3 bg-s1 rounded-2xl p-4">
              <div className="font-bold">{deload.state === 'suggested' ? 'Te conviene una semana de descarga' : `Llevas ${deload.weeksSince} semanas sin descarga`}</div>
              <p className="text-[13.5px] text-mute mt-1 leading-snug">
                {deload.state === 'suggested' ? `${deload.reasons.join('. ')}.` : 'Tu recuperación y tu carga van bien: puedes posponerla sin problema.'} Tú decides.
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => deloadAction('start')}>Iniciar descarga</Button>
                <Button variant="secondary" size="sm" onClick={() => deloadAction('snooze')}>Más adelante</Button>
              </div>
            </div>
          )}
          {adjustment.notes.map((n, i) => <p key={i} className="mt-3 text-[14px] leading-snug text-[#d8d8dc] flex gap-2.5"><Icon name="info" size={17} className="shrink-0 mt-0.5 text-accent" />{n}</p>)}
          {!todayLogged && (
            <button onClick={() => setCheckin(true)} className="mt-3 w-full flex items-center gap-3 bg-s1 rounded-2xl px-4 py-3.5 text-left active:bg-s2">
              <div className="flex-1"><div className="font-semibold text-[15px]">¿Cómo has dormido y cómo te sientes?</div><div className="text-[12.5px] text-mute mt-0.5">{r.level === 'unknown' ? 'Opcional · adapta tus cargas a tu recuperación' : 'Actualiza el registro de hoy'}</div></div>
              <Icon name="chev" size={16} className="text-dim" />
            </button>
          )}
        </section>
      )}

      {/* Semana */}
      <section className="px-6 mt-11">
        <div className="flex items-end justify-between">
          <Label>Esta semana</Label>
          <button onClick={() => push({ name: 'plan' })} className="text-[12px] font-semibold text-accent">Editar semana</button>
        </div>
        <div className="mt-4 flex items-center gap-5">
          <Ring value={week.completed / Math.max(1, planned)} size={84} stroke={7}>
            <div className="num text-2xl font-bold leading-none">{week.completed}<span className="text-mute text-base">/{planned}</span></div>
          </Ring>
          <div className="flex-1 flex justify-between">
            {WEEKDAYS_SHORT.map((l, i) => {
              const s = plan.slots[i]
              const done = week.days[i]
              const isToday = i === today
              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold ${s ? DOT[s.type] : 'bg-s2'} ${isToday ? 'ring-2 ring-white ring-offset-2 ring-offset-bg' : ''} ${done ? '' : 'opacity-60'}`} aria-label={`${l}: ${s?.label ?? ''}${done ? ', hecho' : ''}`}>
                    {done ? <Icon name="check" size={15} stroke={3.2} /> : s ? SLOT_SHORT[s.type] : ''}
                  </div>
                  <span className={`text-[11px] font-semibold ${isToday ? 'text-white' : 'text-dim'}`}>{l}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-3 mt-7 divide-x divide-line">
          <MiniStat label="Días" value={`${week.days.filter(Boolean).length}`} />
          <MiniStat label="Tiempo" value={week.minutes ? formatDuration(week.minutes * 60000) : '0 min'} />
          <MiniStat label="Carga (UA)" value={formatNumber(Math.round(week.load), 0)} />
        </div>
        {streak > 1 && <div className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-accent"><Icon name="flame" size={14} />{streak} semanas cumpliendo el gimnasio</div>}
      </section>

      {/* Últimos */}
      <section className="px-6 mt-11">
        <Label>Últimos entrenamientos</Label>
        {sessions.length || activities.length ? (
          <div className="mt-2">
            {[
              ...sessions.slice(0, 4).map((s) => ({ key: s.id, ts: s.endedAt, title: s.dayName, sub: formatDuration(sessionDuration(s)), right: `${formatNumber(sessionVolume(s) / 1000, 1)} t`, go: () => push({ name: 'session', id: s.id }) })),
              ...activities.slice(0, 4).map((a) => ({ key: a.id, ts: a.ts, title: a.disciplines?.length ? `${a.sport} · ${a.disciplines.slice(0, 2).join(', ')}` : a.sport, sub: `${a.minutes} min · RPE ${a.rpe}${a.sparring ? ' · sparring' : ''}`, right: a.kind === 'recovery' ? 'REC' : 'CMB', go: undefined as undefined | (() => void) })),
            ].sort((a, b) => b.ts - a.ts).slice(0, 5).map((x) => (
              <Row key={x.key} onClick={x.go}>
                <div className="flex-1 min-w-0"><div className="font-semibold truncate">{x.title}</div><div className="text-[13px] text-mute mt-0.5">{formatDateShort(x.ts)} · {x.sub}</div></div>
                <div className="num font-bold text-[13px] text-mute">{x.right}</div>
                {x.go && <Icon name="chev" size={16} className="text-dim" />}
              </Row>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-mute text-[15px] leading-relaxed">Aún no has registrado entrenamientos. Cuando termines el primero aparecerá aquí.</p>
        )}
      </section>

      <Sheet open={checkin} onClose={() => setCheckin(false)} title="Cómo te sientes hoy"><div className="space-y-5 pb-4"><RecoverySection /></div></Sheet>
      <CombatSheet open={combatOpen} onClose={() => setCombatOpen(false)} />
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <div className="num text-xl font-bold leading-none whitespace-nowrap">{value}</div>
      <Label className="mt-1.5">{label}</Label>
    </div>
  )
}
