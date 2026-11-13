import { useState } from 'react'
import { Icon } from '../components/Icon'
import { MultiChips, NumInput, Seg, SubLabel, TextInput } from '../components/fields'
import { Button, Header, Label, Sheet, Toggle } from '../components/ui'
import { WEEKDAYS } from '../lib/utils'
import { DISCIPLINES, INTENSITY_LABEL } from '../services/combatService'
import { SLOT_LABEL, errorsOf, gymFocus, isTraining, swapSlots, updateSlot, validatePlan, type PlanIssue } from '../services/planningService'
import { useNav } from '../nav'
import { useStore } from '../store'
import type { CombatDiscipline, Intensity, PlanSlot, SlotType } from '../types'

const TONE: Record<SlotType, string> = { gym: 'bg-white text-black', combat: 'bg-accent text-black', recovery: 'bg-s3 text-white', rest: 'bg-s1 text-dim border border-line' }
const LEVEL = { error: 'text-danger', warning: 'text-[#ffb340]', info: 'text-mute' } as const

export function PlanScreen() {
  const { plan, profile, planRoutine, changePlan, resetPlan, showToast } = useStore()
  const { pop } = useNav()
  const [edit, setEdit] = useState<PlanSlot | null>(null)
  const [swap, setSwap] = useState<number | null>(null)
  const [reset, setReset] = useState(false)
  const [blocked, setBlocked] = useState<PlanIssue[]>([])
  const issues = validatePlan(plan, profile, planRoutine)
  const count = (t: SlotType) => plan.slots.filter((s) => s.type === t).length
  const rec = count('recovery') + count('rest')

  const apply = (fn: Parameters<typeof changePlan>[0], after?: () => void) => {
    const r = changePlan(fn)
    if (r.ok) { setBlocked([]); after?.(); showToast('Semana actualizada') } else setBlocked(errorsOf(r.issues))
    return r.ok
  }

  return (
    <div className="h-full flex flex-col">
      <Header title="Semana" onBack={pop} />
      <div className="scroll flex-1 px-6 pb-10">
        <p className="text-mute text-[14.5px] leading-relaxed">Tu semana tipo. Puedes mover o cambiar cualquier día: los cambios que rompan las reglas de recuperación no se aplican.</p>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Count label="Gimnasio" n={count('gym')} target={profile.weeklyGoal} />
          <Count label="Combate" n={count('combat')} target={profile.contactSessionsPerWeek} />
          <Count label="Recuperación" n={rec} target={profile.recoveryDaysPerWeek ?? 2} min />
        </div>

        <div className="mt-7">
          {plan.slots.map((s) => {
            const lib = planRoutineDay(s, planRoutine?.days)
            return (
              <button key={s.day} onClick={() => { setEdit(s); setBlocked([]) }} className="w-full flex items-center gap-4 py-3.5 border-b border-line/70 last:border-0 text-left active:bg-s1">
                <div className="w-14 text-[12px] font-semibold uppercase tracking-wider text-mute">{WEEKDAYS[s.day].slice(0, 3)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-bold text-[17px] tracking-tight truncate">{s.label}</span>
                    {s.type === 'combat' && s.combat?.sparring && <span className="text-[10px] font-bold text-accent border border-accent/50 rounded px-1.5 py-0.5">SPARRING</span>}</div>
                  <div className="text-[12.5px] text-mute mt-0.5 leading-snug">{s.focus ?? SLOT_LABEL[s.type]}{lib ? ` · ${lib.exercises.length} ejercicios` : ''}</div>
                </div>
                <span className={`text-[10.5px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${TONE[s.type]}`}>{SLOT_LABEL[s.type]}</span>
              </button>
            )
          })}
        </div>

        <Label className="mt-10">Comprobación de la semana</Label>
        {issues.length === 0 ? (
          <div className="mt-2 flex items-center gap-2 text-accent font-semibold"><Icon name="check" size={18} stroke={2.6} /> Semana equilibrada</div>
        ) : (
          <ul className="mt-2 space-y-2">
            {[...issues].sort((a, b) => ['error', 'warning', 'info'].indexOf(a.level) - ['error', 'warning', 'info'].indexOf(b.level)).map((i, n) => (
              <li key={n} className={`text-[14px] leading-snug flex gap-2.5 ${LEVEL[i.level]}`}><span className="shrink-0">{i.level === 'error' ? '✕' : i.level === 'warning' ? '⚠' : 'ℹ'}</span><span className="text-[#d8d8dc]">{i.message}</span></li>
            ))}
          </ul>
        )}
        <Button variant="ghost" size="md" className="w-full mt-8 border border-line" onClick={() => setReset(true)}>Restaurar semana por defecto</Button>
      </div>

      <Sheet open={!!edit} onClose={() => { setEdit(null); setSwap(null) }} title={edit ? WEEKDAYS[edit.day] : undefined}>
        {edit && (
          <SlotEditor key={edit.day} slot={edit} blocked={blocked}
            onSave={(draft) => { const next = { ...draft, day: edit.day }; apply((p) => updateSlot(p, edit.day, next), () => setEdit(null)) }}
            onSwap={() => setSwap(edit.day)} />
        )}
      </Sheet>
      <Sheet open={swap !== null} onClose={() => setSwap(null)} title="Intercambiar con…">
        <p className="text-[13.5px] text-mute leading-relaxed">Mueve «{swap !== null ? plan.slots[swap].label : ''}» a otro día; el contenido de ese día pasa al actual.</p>
        <div className="mt-4 space-y-2">
          {plan.slots.filter((s) => s.day !== swap).map((s) => (
            <Button key={s.day} variant="secondary" className="w-full justify-between" onClick={() => apply((p) => swapSlots(p, swap!, s.day), () => { setSwap(null); setEdit(null) })}>
              <span>{WEEKDAYS[s.day]}</span><span className="text-mute text-sm font-normal">{s.label}</span>
            </Button>
          ))}
        </div>
        {blocked.length > 0 && <Blocked issues={blocked} />}
      </Sheet>
      <Sheet open={reset} onClose={() => setReset(false)} title="¿Restaurar la semana?">
        <p className="text-mute leading-relaxed">Vuelve a la semana híbrida predeterminada (GYM A/B/C, MMA, recuperación y descanso). Tu historial no se toca.</p>
        <div className="mt-5 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setReset(false)}>Cancelar</Button><Button className="flex-1" onClick={() => { resetPlan(); setReset(false); showToast('Semana restaurada') }}>Restaurar</Button></div>
      </Sheet>
    </div>
  )
}

const planRoutineDay = (s: PlanSlot, days?: { id: string; exercises: unknown[] }[]) => days?.find((d) => d.id === s.routineDayId)

function Count({ label, n, target, min }: { label: string; n: number; target?: number; min?: boolean }) {
  const ok = target === undefined || (min ? n >= target : n === target)
  return (
    <div className="bg-s1 rounded-2xl px-3.5 py-3">
      <div className={`num text-[24px] font-bold leading-none ${ok ? '' : 'text-[#ffb340]'}`}>{n}{target !== undefined && <span className="text-mute text-base">/{target}{min ? '+' : ''}</span>}</div>
      <Label className="mt-1.5 !text-[10px]">{label}</Label>
    </div>
  )
}

function Blocked({ issues }: { issues: PlanIssue[] }) {
  return (
    <div className="mt-4 rounded-xl bg-danger/10 px-3.5 py-3" role="alert">
      <div className="text-[12px] font-bold uppercase tracking-wider text-danger">No se puede aplicar</div>
      {issues.map((i, n) => <div key={n} className="text-[14px] mt-1 leading-snug">{i.message}</div>)}
      <div className="text-[12.5px] text-mute mt-1.5">Las reglas de recuperación protegen tu semana. Cambia primero otro día.</div>
    </div>
  )
}

function SlotEditor({ slot, blocked, onSave, onSwap }: { slot: PlanSlot; blocked: PlanIssue[]; onSave: (s: PlanSlot) => void; onSwap: () => void }) {
  const { planRoutine } = useStore()
  const [d, setD] = useState<PlanSlot>(slot)
  const set = (p: Partial<PlanSlot>) => setD((cur) => ({ ...cur, ...p }))
  const days = planRoutine?.days ?? []
  const focus = d.type === 'gym' ? gymFocus(d, planRoutine) : undefined
  return (
    <div className="space-y-5">
      <Seg<SlotType> value={d.type} onChange={(t) => {
        const defaults: Record<SlotType, string> = { gym: 'GYM', combat: 'MMA', recovery: 'RECUPERACIÓN', rest: 'DESCANSO COMPLETO' }
        const keep = d.label === defaults[d.type] || !d.label
        set({ type: t, label: keep ? defaults[t] : d.label, focus: d.focus === slot.focus ? undefined : d.focus, intensity: t === 'combat' ? d.intensity ?? 'moderate' : isTraining(t) ? d.intensity : 'light', combat: t === 'combat' ? d.combat ?? { disciplines: [], sparring: false } : undefined, routineDayId: t === 'gym' ? d.routineDayId : undefined })
      }} options={[{ v: 'gym', l: 'Gym' }, { v: 'combat', l: 'Combate' }, { v: 'recovery', l: 'Recup.' }, { v: 'rest', l: 'Descanso' }]} />
      <TextInput label="Nombre" value={d.label} onChange={(v) => set({ label: v })} />
      <TextInput label="Enfoque" value={d.focus ?? ''} onChange={(v) => set({ focus: v || undefined })} placeholder="Opcional" />
      {d.type === 'gym' && (
        <div>
          <SubLabel>Día de la rutina</SubLabel>
          <MultiChips single options={days.map((x) => x.name)} value={days.find((x) => x.id === d.routineDayId) ? [days.find((x) => x.id === d.routineDayId)!.name] : []} onChange={(v) => set({ routineDayId: days.find((x) => x.name === v[0])?.id })} />
          {focus && <p className="text-[12px] text-dim mt-2">Foco detectado: {focus === 'lower' ? 'tren inferior' : focus === 'upper' ? 'tren superior' : 'cuerpo completo'}.</p>}
        </div>
      )}
      {d.type === 'combat' && (
        <>
          <div><SubLabel>Intensidad prevista</SubLabel><Seg<Intensity> value={d.intensity} onChange={(v) => set({ intensity: v })} options={(['light', 'moderate', 'hard'] as Intensity[]).map((v) => ({ v, l: INTENSITY_LABEL[v] }))} /></div>
          <div><SubLabel>Disciplinas</SubLabel><MultiChips options={DISCIPLINES} value={d.combat?.disciplines ?? []} onChange={(v) => set({ combat: { ...(d.combat ?? { disciplines: [] }), disciplines: v as CombatDiscipline[] } })} /></div>
          <div className="bg-s1 rounded-2xl p-4 flex items-center"><div className="flex-1"><div className="font-semibold">Sparring previsto</div><div className="text-[12.5px] text-mute">Modera las piernas del día anterior</div></div><Toggle on={!!d.combat?.sparring} onChange={(v) => set({ combat: { ...(d.combat ?? { disciplines: [] }), sparring: v } })} /></div>
          <NumInput label="Duración habitual" unit="min" value={d.combat?.minutes} max={300} onChange={(n) => set({ combat: { ...(d.combat ?? { disciplines: [] }), minutes: n } })} />
        </>
      )}
      {blocked.length > 0 && <Blocked issues={blocked} />}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onSwap}>Intercambiar día</Button>
        <Button className="flex-1" onClick={() => onSave(d)}>GUARDAR</Button>
      </div>
    </div>
  )
}
