/**
 * INICIO — resumen de todas las áreas SIN mezclar sus funciones:
 * cada tarjeta muestra un resumen y lleva a su sección (Gym, Combat, Filosofía, Progreso).
 * Lo único que se gestiona aquí son los indicadores globales de recuperación.
 */
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { Button, Label, Ring, Sheet } from '../../../shared/components/ui'
import { RecoverySection } from '../../../shared/components/RecoverySection'
import { dateKey, formatDateLong, formatDateShort, formatNumber, formatDuration, greeting, startOfWeek, weekdayIndex, WEEKDAYS_SHORT } from '../../../shared/lib/utils'
import { loadBetween, sessionMinutes } from '../../../shared/services/fatigueService'
import { SLOT_SHORT, nextCombat, nextGym, todayPlan } from '../../../shared/services/planningService'
import { deloadStatus, readiness } from '../../../shared/services/recoveryService'
import { estimateMinutes } from '../../gym/services/workoutService'
import { INTENSITY_LABEL, isCombat } from '../../combat/services/combatService'
import { quoteOfDay, suggestedTheme } from '../../philosophy/services/philosophyService'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'
import type { SlotType } from '../../../types'

const DAY = 86400000
const DOT: Record<SlotType, string> = { gym: 'bg-white/90 text-black', combat: 'bg-accent/90 text-black', recovery: 'bg-s3 text-white', rest: 'bg-s2 text-dim' }
const TODAY_LABEL: Record<SlotType, string> = { gym: 'Hoy toca gimnasio', combat: 'Hoy toca combate', recovery: 'Hoy toca recuperación activa', rest: 'Hoy es descanso completo' }

function Card({ icon, title, children, onClick, cta }: { icon: string; title: string; children: React.ReactNode; onClick: () => void; cta: string }) {
  return (
    <button onClick={onClick} className="w-full text-left bg-s1 rounded-3xl p-5 active:bg-s2 transition">
      <div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-full bg-s2 grid place-items-center text-accent"><Icon name={icon} size={17} /></span><Label>{title}</Label><span className="ml-auto text-[12px] font-semibold text-accent flex items-center gap-0.5">{cta}<Icon name="chev" size={14} /></span></div>
      <div className="mt-3.5">{children}</div>
    </button>
  )
}

export function HomeScreen() {
  const { profile, sessions, activities, wellness, plan, ctx, active, adjustment, deloadAction } = useStore()
  const { go, push } = useNav()
  const [checkin, setCheckin] = useState(false)
  const t = todayPlan(ctx)
  const gym = nextGym(ctx)
  const combat = nextCombat(ctx)
  const deload = deloadStatus(ctx)
  const r = readiness(wellness)
  const todayLogged = wellness.some((w) => w.id === dateKey())
  const today = weekdayIndex()
  const quote = quoteOfDay(new Date())
  const lastGym = sessions[0]
  const lastCombat = activities.find(isCombat)

  const week = useMemo(() => {
    const start = startOfWeek()
    const end = start + 7 * DAY
    const g = sessions.filter((s) => s.endedAt >= start && s.endedAt < end)
    const a = activities.filter((x) => x.ts >= start && x.ts < end)
    const days = Array(7).fill(false) as boolean[]
    for (const s of g) days[Math.min(6, Math.floor((s.endedAt - start) / DAY))] = true
    for (const x of a) days[Math.min(6, Math.floor((x.ts - start) / DAY))] = true
    return { days, minutes: g.reduce((acc, s) => acc + sessionMinutes(s), 0) + a.reduce((acc, x) => acc + x.minutes, 0), load: loadBetween(sessions, activities, start, end).total, completed: g.length + a.filter(isCombat).length }
  }, [sessions, activities])
  const planned = plan.slots.filter((s) => s.type === 'gym' || s.type === 'combat' || s.routineDayId).length || profile.weeklyGoal
  const ago = (ts: number) => { const d = Math.floor((Date.now() - ts) / DAY); return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días` }

  return (
    <div className="scroll h-full pb-8">
      <div className="pt-safe px-6 pt-4">
        <Label className="first-letter:uppercase">{formatDateLong()}</Label>
        <h1 className="text-[34px] leading-[1.1] font-bold tracking-tight mt-1.5">
          {greeting()}{profile.name.trim() ? <>,<br /><span className="text-mute">{profile.name.trim()}</span></> : null}
        </h1>
        {t.slot && <p className="text-mute mt-3 text-[15px]">{TODAY_LABEL[t.slot.type]}{t.slot.label && t.slot.type !== 'rest' && t.slot.type !== 'recovery' ? ` · ${t.slot.label}` : ''}</p>}
      </div>

      <div className="px-6 mt-7 space-y-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card icon="gym" title="Gym" cta={active ? 'Continuar' : 'Ir a Gym'} onClick={() => go('gym', 'today')}>
            {active ? <><div className="text-[20px] font-bold tracking-tight">{active.dayName}</div><div className="text-[13.5px] text-accent mt-1 font-semibold">Entrenamiento en curso</div></>
              : gym ? <><div className="text-[12.5px] text-mute font-semibold">{gym.label === 'Hoy' ? 'Hoy' : `Próximo · ${gym.label}`}</div>
                <div className="text-[20px] font-bold tracking-tight mt-0.5">{gym.day.name}</div>
                <div className="text-[13.5px] text-mute mt-1">{gym.day.exercises.length} ejercicios · ~{estimateMinutes(gym.day)} min</div></>
              : <div className="text-[15px] text-mute">Sin días de gimnasio asignados.</div>}
            {lastGym && <div className="text-[12px] text-dim mt-3">Último: {lastGym.dayName} · {ago(lastGym.endedAt)}</div>}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card icon="glove" title="Combat" cta="Ir a Combat" onClick={() => go('combat', 'overview')}>
            {combat ? <><div className="text-[12.5px] text-mute font-semibold">{combat.label === 'Hoy' ? 'Hoy' : `Próxima · ${combat.label}`}</div>
              <div className="text-[20px] font-bold tracking-tight mt-0.5">{combat.slot.label}</div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {combat.slot.intensity && <span className="text-[11.5px] font-semibold bg-s2 rounded-full px-2.5 py-1">Intensidad {INTENSITY_LABEL[combat.slot.intensity].toLowerCase()}</span>}
                {combat.slot.combat?.sparring && <span className="text-[11.5px] font-semibold text-accent border border-accent/50 rounded-full px-2.5 py-1">Sparring</span>}
              </div></>
              : <div className="text-[15px] text-mute">Sin sesiones de combate planificadas.</div>}
            {lastCombat && <div className="text-[12px] text-dim mt-3">Última: {lastCombat.sport} · {ago(lastCombat.ts)} · RPE {lastCombat.rpe}</div>}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card icon="column" title="Filosofía" cta="Ir a Filosofía" onClick={() => go('philosophy', 'today')}>
            <div className="text-[17px] font-semibold leading-snug tracking-tight">«{quote.text}»</div>
            <div className="text-[12.5px] text-mute mt-2">{quote.author} · {suggestedTheme(r.level) === 'calma' ? 'hoy, calma' : 'frase del día'}</div>
          </Card>
        </motion.div>
      </div>

      {/* Recuperación: indicadores globales compartidos */}
      <section className="px-6 mt-10">
        <Label>Recuperación</Label>
        {t.slot?.type === 'recovery' && !t.done && (
          <button onClick={() => push({ name: 'shared.mobility' })} className="mt-3 w-full flex items-center gap-3 bg-s1 rounded-2xl px-4 py-3.5 text-left active:bg-s2">
            <Icon name="clock" size={20} className="text-accent" /><div className="flex-1"><div className="font-semibold text-[15px]">Sesión de recuperación activa</div><div className="text-[12.5px] text-mute mt-0.5">Movilidad suave · RPE 2</div></div><Icon name="chev" size={16} className="text-dim" />
          </button>
        )}
        {deload.state === 'active' && (
          <div className="mt-3 bg-s1 rounded-2xl p-4"><div className="font-bold">Semana de descarga activa</div><p className="text-[13.5px] text-mute mt-1 leading-snug">Hasta el {formatDateShort(deload.endsAt!)}: menos series y menos carga, sin sparring duro.</p><Button variant="secondary" size="sm" className="mt-3" onClick={() => deloadAction('end')}>Terminar descarga</Button></div>
        )}
        {(deload.state === 'suggested' || deload.state === 'due-fine') && (
          <div className="mt-3 bg-s1 rounded-2xl p-4">
            <div className="font-bold">{deload.state === 'suggested' ? 'Te conviene una semana de descarga' : `Llevas ${deload.weeksSince} semanas sin descarga`}</div>
            <p className="text-[13.5px] text-mute mt-1 leading-snug">{deload.state === 'suggested' ? `${deload.reasons.join('. ')}.` : 'Tu recuperación y tu carga van bien: puedes posponerla sin problema.'} Tú decides.</p>
            <div className="flex gap-2 mt-3"><Button size="sm" onClick={() => deloadAction('start')}>Iniciar descarga</Button><Button variant="secondary" size="sm" onClick={() => deloadAction('snooze')}>Más adelante</Button></div>
          </div>
        )}
        {adjustment.notes.map((n, i) => <p key={i} className="mt-3 text-[14px] leading-snug text-[#d8d8dc] flex gap-2.5"><Icon name="info" size={17} className="shrink-0 mt-0.5 text-accent" />{n}</p>)}
        {!todayLogged && (
          <button onClick={() => setCheckin(true)} className="mt-3 w-full flex items-center gap-3 bg-s1 rounded-2xl px-4 py-3.5 text-left active:bg-s2">
            <div className="flex-1"><div className="font-semibold text-[15px]">¿Cómo has dormido y cómo te sientes?</div><div className="text-[12.5px] text-mute mt-0.5">{r.level === 'unknown' ? 'Opcional · adapta tus cargas a tu recuperación' : 'Actualiza el registro de hoy'}</div></div>
            <Icon name="chev" size={16} className="text-dim" />
          </button>
        )}
        {todayLogged && !adjustment.notes.length && deload.state === 'not-due' && <p className="mt-2 text-[14px] text-mute">Recuperación {r.level === 'good' ? 'buena' : r.level === 'moderate' ? 'media' : r.level === 'low' ? 'baja' : 'registrada'}. Sin ajustes necesarios hoy.</p>}
      </section>

      {/* Progreso: resumen */}
      <section className="px-6 mt-11">
        <div className="flex items-end justify-between"><Label>Esta semana</Label><button onClick={() => go('progress')} className="text-[12px] font-semibold text-accent">Ver progreso</button></div>
        <div className="mt-4 flex items-center gap-5">
          <Ring value={week.completed / Math.max(1, planned)} size={84} stroke={7}><div className="num text-2xl font-bold leading-none">{week.completed}<span className="text-mute text-base">/{planned}</span></div></Ring>
          <div className="flex-1 flex justify-between">
            {WEEKDAYS_SHORT.map((l, i) => {
              const s = plan.slots[i]; const done = week.days[i]; const isToday = i === today
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
      </section>

      <Sheet open={checkin} onClose={() => setCheckin(false)} title="Cómo te sientes hoy"><div className="space-y-5 pb-4"><RecoverySection /></div></Sheet>
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
