import { useState } from 'react'
import { MultiChips, NumInput, Seg, SubLabel, TextInput } from '../../../shared/components/fields'
import { Button, Sheet, Toggle } from '../../../shared/components/ui'
import { WEEKDAYS } from '../../../shared/lib/utils'
import { errorsOf, type PlanIssue } from '../../../shared/services/planningService'
import { useStore } from '../../../store'
import type { CombatDiscipline, CombatSlot, CombatSport, Intensity } from '../../../types'
import { COMBAT_SECTIONS, DISCIPLINES, INTENSITY_LABEL } from '../services/combatService'

/** Edita la sesión de combate de un día de la semana. Solo toca datos de COMBAT. */
export function SessionEditor({ day, open, onClose }: { day: number | null; open: boolean; onClose: () => void }) {
  const { combatPlan, changeCombatPlan, profile, showToast } = useStore()
  const existing = day === null ? undefined : combatPlan.sessions.find((s) => s.day === day)
  const primary = (COMBAT_SECTIONS as string[]).includes(profile.primaryDiscipline ?? '') ? (profile.primaryDiscipline as CombatSport) : 'MMA'
  const [blocked, setBlocked] = useState<PlanIssue[]>([])
  return (
    <Sheet open={open && day !== null} onClose={onClose} title={day !== null ? `${WEEKDAYS[day]} · ${existing ? 'Editar sesión' : 'Nueva sesión'}` : undefined}>
      {day !== null && (
        <Form key={`${day}-${existing ? 'e' : 'n'}`} init={existing ?? { day, sport: primary, label: primary, intensity: 'moderate', areas: [], sparring: false }} isNew={!existing} blocked={blocked}
          onSave={(s) => { const r = changeCombatPlan((c) => ({ ...c, sessions: [...c.sessions.filter((x) => x.day !== day), s].sort((a, b) => a.day - b.day) })); if (r.ok) { setBlocked([]); showToast('Sesión guardada'); onClose() } else setBlocked(errorsOf(r.issues)) }}
          onDelete={() => { changeCombatPlan((c) => ({ ...c, sessions: c.sessions.filter((x) => x.day !== day) })); setBlocked([]); showToast('Sesión eliminada'); onClose() }} />
      )}
    </Sheet>
  )
}

function Form({ init, isNew, blocked, onSave, onDelete }: { init: CombatSlot; isNew: boolean; blocked: PlanIssue[]; onSave: (s: CombatSlot) => void; onDelete: () => void }) {
  const [d, setD] = useState<CombatSlot>(init)
  const set = (p: Partial<CombatSlot>) => setD((c) => ({ ...c, ...p }))
  return (
    <div className="space-y-5">
      <div><SubLabel>Disciplina</SubLabel><MultiChips single options={COMBAT_SECTIONS.map(String)} value={[d.sport]} onChange={(v) => { const s = (v[0] as CombatSport) ?? d.sport; set({ sport: s, label: d.label === d.sport ? s : d.label }) }} /></div>
      <TextInput label="Nombre" value={d.label} onChange={(v) => set({ label: v })} />
      <TextInput label="Enfoque" value={d.focus ?? ''} onChange={(v) => set({ focus: v || undefined })} placeholder="Opcional" />
      <div><SubLabel>Intensidad prevista</SubLabel><Seg<Intensity> value={d.intensity} onChange={(v) => set({ intensity: v })} options={(['light', 'moderate', 'hard'] as Intensity[]).map((v) => ({ v, l: INTENSITY_LABEL[v] }))} />
        <p className="text-[12px] text-dim mt-2">No todo el combate es intenso: una sesión técnica es ligera.</p></div>
      {d.sport === 'MMA' && <div><SubLabel>Áreas</SubLabel><MultiChips options={DISCIPLINES} value={d.areas} onChange={(v) => set({ areas: v as CombatDiscipline[] })} /></div>}
      <div className="bg-s1 rounded-2xl p-4 flex items-center"><div className="flex-1"><div className="font-semibold">Sparring previsto</div><div className="text-[12.5px] text-mute">Modera las piernas del día anterior</div></div><Toggle on={d.sparring} onChange={(v) => set({ sparring: v })} /></div>
      <NumInput label="Duración habitual" unit="min" value={d.minutes} max={300} onChange={(n) => set({ minutes: n })} />
      {blocked.length > 0 && (
        <div className="rounded-xl bg-danger/10 px-3.5 py-3" role="alert">
          <div className="text-[12px] font-bold uppercase tracking-wider text-danger">No se puede aplicar</div>
          {blocked.map((i, n) => <div key={n} className="text-[14px] mt-1 leading-snug">{i.message}</div>)}
          <div className="text-[12.5px] text-mute mt-1.5">Las reglas de recuperación protegen tu semana. Cambia primero otro día.</div>
        </div>
      )}
      <div className="flex gap-2">
        {!isNew && <Button variant="danger" onClick={onDelete}>Eliminar</Button>}
        <Button className="flex-1" onClick={() => onSave(d)}>GUARDAR</Button>
      </div>
    </div>
  )
}
