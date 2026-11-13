import { motion } from 'framer-motion'
import { Icon } from '../components/Icon'
import { Button, Label, Ring, Row } from '../components/ui'
import { activeRoutine, estimateMinutes, getPlan, greeting } from '../lib/plan'
import { sessionDuration, sessionVolume, streakWeeks, weekSummary } from '../lib/stats'
import { WEEKDAYS_SHORT, formatDateLong, formatDateShort, formatDuration, formatNumber, formatVolume, weekdayIndex } from '../lib/utils'
import { useNav } from '../nav'
import { useStore } from '../store'

export function HomeScreen() {
  const { settings, routines, sessions, active, startWorkout } = useStore()
  const { setTab, push } = useNav()
  const routine = activeRoutine(routines, settings)
  const plan = getPlan(routine, sessions)
  const week = weekSummary(sessions)
  const goal = Math.max(1, settings.weeklyGoal)
  const today = weekdayIndex()
  const date = formatDateLong()
  const streak = streakWeeks(sessions, goal)

  const start = () => {
    if (!active) startWorkout(plan.routine, plan.today)
    setTab('train')
  }

  return (
    <div className="scroll h-full pb-8">
      <div className="pt-safe px-6 pt-4">
        <Label className="first-letter:uppercase">{date}</Label>
        <h1 className="text-[34px] leading-[1.1] font-bold tracking-tight mt-1.5">
          {greeting()}{settings.name ? <>,<br /><span className="text-mute">{settings.name}</span></> : null}
        </h1>
      </div>

      {/* Hoy */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="px-6 mt-9">
        <Label>{active ? 'En curso' : plan.todayDone ? 'Completado hoy' : plan.today && !plan.rotation ? 'Hoy' : plan.today ? 'Te toca' : 'Hoy'}</Label>
        {plan.today || active ? (
          <>
            <div className="mt-2 text-[28px] font-bold leading-tight tracking-tight">{active ? active.dayName : plan.today!.name}</div>
            <div className="text-mute mt-1 text-[15px]">
              {active ? active.routineName : `${plan.routine!.name} · ${plan.today!.exercises.length} ejercicios · ~${estimateMinutes(plan.today!)} min`}
            </div>
            {!active && (
              <div className="flex flex-wrap gap-x-2 gap-y-1 mt-3 text-[13px] text-dim">
                {[...new Set(plan.today!.exercises.map((e) => e.muscle))].slice(0, 5).map((m) => <span key={m} className="after:content-['·'] after:ml-2 last:after:content-['']">{m}</span>)}
              </div>
            )}
            <Button onClick={start} className="w-full mt-6 text-[15px] tracking-[0.08em]">
              <Icon name="bolt" size={20} stroke={2.4} />
              {active ? 'CONTINUAR ENTRENAMIENTO' : plan.todayDone ? 'ENTRENAR DE NUEVO' : 'COMENZAR ENTRENAMIENTO'}
            </Button>
          </>
        ) : routine ? (
          <>
            <div className="mt-2 text-[28px] font-bold leading-tight tracking-tight">Día de descanso</div>
            <div className="text-mute mt-1 text-[15px]">No hay entrenamiento programado hoy en «{routine.name}».</div>
            <Button onClick={() => setTab('routines')} variant="secondary" className="w-full mt-6">Elegir un día para entrenar</Button>
          </>
        ) : (
          <>
            <div className="mt-2 text-[28px] font-bold leading-tight tracking-tight">Empieza por tu rutina</div>
            <div className="text-mute mt-1 text-[15px] leading-relaxed">Pídele una rutina a ChatGPT e impórtala, o carga la de ejemplo para probar la app.</div>
            <Button onClick={() => push({ name: 'import' })} className="w-full mt-6 tracking-[0.08em]"><Icon name="upload" size={20} /> IMPORTAR RUTINA</Button>
          </>
        )}
        {plan.next && (
          <button onClick={() => setTab('routines')} className="mt-5 flex items-center gap-2 text-[13px] text-mute w-full text-left">
            <Icon name="clock" size={15} /> <span><span className="text-white font-semibold">{plan.next.label}</span> · {plan.next.day.name}</span>
          </button>
        )}
      </motion.section>

      {/* Semana */}
      <section className="px-6 mt-11">
        <div className="flex items-end justify-between">
          <Label>Esta semana</Label>
          {streak > 1 && <span className="flex items-center gap-1 text-[12px] font-semibold text-accent"><Icon name="flame" size={14} />{streak} semanas seguidas</span>}
        </div>
        <div className="mt-4 flex items-center gap-5">
          <Ring value={week.sessions.length / goal} size={84} stroke={7}>
            <div className="text-center leading-none">
              <div className="num text-2xl font-bold">{week.sessions.length}<span className="text-mute text-base">/{goal}</span></div>
            </div>
          </Ring>
          <div className="flex-1">
            <div className="flex justify-between">
              {WEEKDAYS_SHORT.map((l, i) => {
                const done = week.daysTrained[i]
                const isToday = i === today
                return (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className={`w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold ${done ? 'bg-accent text-black' : isToday ? 'border-2 border-white text-white' : 'bg-s2 text-dim'}`}>
                      {done ? <Icon name="check" size={15} stroke={3} /> : null}
                    </div>
                    <span className={`text-[11px] font-semibold ${isToday ? 'text-white' : 'text-dim'}`}>{l}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 mt-7 divide-x divide-line">
          <MiniStat label="Días" value={`${week.daysTrained.filter(Boolean).length}`} />
          <MiniStat label="Tiempo" value={week.totalMs ? formatDuration(week.totalMs) : '0 min'} />
          <MiniStat label="Volumen" value={formatVolume(week.volume)} />
        </div>
      </section>

      {/* Últimos */}
      <section className="px-6 mt-11">
        <Label>Últimos entrenamientos</Label>
        {sessions.length ? (
          <div className="mt-2">
            {sessions.slice(0, 4).map((s) => (
              <Row key={s.id} onClick={() => push({ name: 'session', id: s.id })}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{s.dayName}</div>
                  <div className="text-[13px] text-mute mt-0.5">{formatDateShort(s.endedAt)} · {formatDuration(sessionDuration(s))}</div>
                </div>
                <div className="text-right">
                  <div className="num font-bold">{formatNumber(sessionVolume(s) / 1000, 1)}<span className="text-mute text-xs font-semibold ml-0.5">t</span></div>
                </div>
                <Icon name="chev" size={16} className="text-dim" />
              </Row>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-mute text-[15px] leading-relaxed">Aún no has registrado entrenamientos. Cuando termines el primero aparecerá aquí.</p>
        )}
      </section>
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
