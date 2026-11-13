import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Button, Header, Label, Sheet, Stat } from '../components/ui'
import { epley } from '../lib/recommend'
import { doneSets, exerciseSeries, sessionDuration, sessionSets, sessionVolume } from '../lib/stats'
import { formatDuration, formatNumber, formatVolume, toDisplay } from '../lib/utils'
import { useNav } from '../nav'
import { useStore } from '../store'

export function SessionDetail({ id }: { id: string }) {
  const { sessions, deleteSession, settings, showToast } = useStore()
  const { pop } = useNav()
  const [confirm, setConfirm] = useState(false)
  const s = sessions.find((x) => x.id === id)
  if (!s) return null
  const u = settings.unit
  return (
    <div className="h-full flex flex-col">
      <Header onBack={pop} />
      <div className="scroll flex-1 px-6 pb-10">
        <Label className="first-letter:uppercase">{new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(s.endedAt)}</Label>
        <h1 className="text-[28px] font-bold tracking-tight leading-tight mt-1.5">{s.dayName}</h1>
        <div className="text-mute mt-1">{s.routineName}</div>
        <div className="grid grid-cols-3 gap-4 mt-7">
          <Stat label="Duración" value={formatDuration(sessionDuration(s)).replace(' min', '')} unit="min" />
          <Stat label="Volumen" value={formatVolume(sessionVolume(s)).split(' ')[0]} unit={formatVolume(sessionVolume(s)).split(' ')[1]} />
          <Stat label="Series" value={sessionSets(s)} />
        </div>
        {s.exercises.map((e) => (
          <div key={e.id} className="mt-9">
            <div className="font-bold text-[18px] tracking-tight">{e.name}</div>
            <div className="text-[12.5px] text-mute">{e.muscle}</div>
            <div className="mt-2">
              {doneSets(e).map((x, i) => (
                <div key={i} className="flex items-center py-2 border-b border-line/60 last:border-0">
                  <span className="num w-7 text-mute font-bold">{i + 1}</span>
                  <span className="num font-bold text-[17px]">{formatNumber(toDisplay(x.weight, u))} <span className="text-mute text-xs">{u}</span></span>
                  <span className="text-dim mx-2">×</span><span className="num font-bold text-[17px]">{x.reps}</span>
                  <span className="ml-auto num text-[12.5px] text-dim">1RM ≈ {formatNumber(toDisplay(epley(x.weight, x.reps), u), 0)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Button variant="danger" size="md" className="w-full mt-12" onClick={() => setConfirm(true)}><Icon name="trash" size={17} /> Eliminar sesión</Button>
      </div>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Eliminar sesión?">
        <p className="text-mute">Se quitará del historial y de las estadísticas.</p>
        <div className="flex gap-2 mt-5"><Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Cancelar</Button><Button variant="danger" className="flex-1" onClick={() => { deleteSession(s.id); showToast('Sesión eliminada'); pop() }}>Eliminar</Button></div>
      </Sheet>
    </div>
  )
}

export function SummaryScreen({ id }: { id: string }) {
  const { sessions, settings } = useStore()
  const { pop } = useNav()
  const s = sessions.find((x) => x.id === id)
  const prs = useMemo(() => {
    if (!s) return []
    const others = sessions.filter((x) => x.id !== s.id && x.endedAt < s.endedAt)
    return s.exercises.flatMap((e) => {
      const prev = exerciseSeries(others, e.name, e.exerciseId)
      if (!prev.length) return []
      const best = Math.max(...prev.map((p) => p.e1rm))
      const now = Math.max(...doneSets(e).map((x) => epley(x.weight, x.reps)))
      return now > best + 0.01 && now > 0 ? [{ name: e.name, gain: now - best }] : []
    })
  }, [s, sessions])
  if (!s) return null
  const u = settings.unit
  return (
    <div className="h-full flex flex-col">
      <div className="scroll flex-1 px-6 pt-safe pb-6">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 14 }} className="w-16 h-16 rounded-full bg-accent text-black grid place-items-center mt-10">
          <Icon name="check" size={34} stroke={3} />
        </motion.div>
        <h1 className="text-[34px] font-bold tracking-tight leading-tight mt-6">Entrenamiento<br />completado</h1>
        <div className="text-mute mt-2">{s.dayName}</div>
        <div className="grid grid-cols-3 gap-4 mt-9">
          <Stat label="Duración" value={formatDuration(sessionDuration(s)).replace(' min', '')} unit="min" />
          <Stat label="Volumen" value={formatNumber(toDisplay(sessionVolume(s), u), 0)} unit={u} />
          <Stat label="Series" value={sessionSets(s)} />
        </div>
        {prs.length > 0 && (
          <div className="mt-10">
            <Label className="flex items-center gap-1.5 text-accent"><Icon name="trophy" size={14} /> Nuevos récords</Label>
            {prs.map((p) => <div key={p.name} className="flex justify-between py-3 border-b border-line/60 last:border-0"><span className="font-semibold">{p.name}</span><span className="num font-bold text-accent">+{formatNumber(toDisplay(p.gain, u))} {u}</span></div>)}
          </div>
        )}
        <div className="mt-10">
          <Label>Resumen</Label>
          {s.exercises.map((e) => (
            <div key={e.id} className="flex justify-between gap-3 py-2.5 border-b border-line/60 last:border-0">
              <span className="font-semibold truncate">{e.name}</span>
              <span className="num text-mute text-[14px] shrink-0">{doneSets(e).length} series · {formatNumber(toDisplay(Math.max(...doneSets(e).map((x) => x.weight)), u))} {u}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-6 pt-3 pb-safe pb-4"><Button className="w-full" onClick={pop}>LISTO</Button></div>
    </div>
  )
}
