import { useEffect, useState } from 'react'
import { MultiChips, NumInput, Rating, SubLabel, TextInput } from './fields'
import { Button, Label } from './ui'
import { MUSCLES } from '../lib/muscles'
import { readiness } from '../services/recoveryService'
import { dateKey } from '../lib/utils'
import { useStore } from '../../store'
import type { Wellness } from '../../types'

const LEVEL = { good: ['Buena', 'bg-glow'], moderate: ['Media', 'bg-[#ffb340]'], low: ['Baja', 'bg-danger'], unknown: ['Sin datos', 'bg-s3'] } as const

export function RecoverySection() {
  const { wellness, saveWellness, deleteWellness, showToast } = useStore()
  const today = dateKey()
  const saved = wellness.find((w) => w.id === today)
  const [w, setW] = useState<Wellness>(saved ?? { id: today })
  useEffect(() => { setW(saved ?? { id: today }) }, [saved, today])
  const set = (p: Partial<Wellness>) => setW((cur) => ({ ...cur, ...p }))
  const any = ['sleepHours', 'sleepQuality', 'energy', 'fatigue', 'soreness', 'recovery'].some((k) => w[k as keyof Wellness] !== undefined)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return { d, r: readiness(wellness.filter((x) => x.id === dateKey(d)), d) }
  })

  return (
    <>
      <p className="text-[13.5px] text-mute leading-relaxed">Opcional. No es un diagnóstico médico.</p>
      <NumInput label="Horas de sueño (anoche)" unit="h" decimal max={16} value={w.sleepHours} onChange={(n) => set({ sleepHours: n })} />
      <Rating label="Calidad del descanso" value={w.sleepQuality} onChange={(v) => set({ sleepQuality: v })} low="mala" high="excelente" />
      <Rating label="Nivel de energía" value={w.energy} onChange={(v) => set({ energy: v })} low="sin energía" high="mucha" />
      <Rating label="Fatiga muscular" value={w.fatigue} onChange={(v) => set({ fatigue: v })} low="nada" high="mucha" />
      <Rating label="Dolor muscular" value={w.soreness} onChange={(v) => set({ soreness: v })} low="nada" high="mucho" />
      {(w.soreness ?? 0) >= 2 && <div><SubLabel>¿Dónde? (opcional)</SubLabel><MultiChips options={[...MUSCLES]} value={w.soreAreas ?? []} onChange={(v) => set({ soreAreas: v })} /></div>}
      <Rating label="Recuperación percibida" value={w.recovery} onChange={(v) => set({ recovery: v })} low="agotado" high="recuperado" />
      <TextInput label="Nota (opcional)" value={w.note ?? ''} onChange={(v) => set({ note: v || undefined })} placeholder="Estrés, viaje, molestia…" />
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!any} onClick={() => {
          const clean: Wellness = { id: today }
          for (const [k, v] of Object.entries(w)) if (v !== undefined && !(Array.isArray(v) && !v.length) && v !== '') (clean as unknown as Record<string, unknown>)[k] = v
          if ((clean.soreness ?? 0) < 2) delete clean.soreAreas
          saveWellness(clean); showToast('Registro de hoy guardado')
        }}>{saved ? 'ACTUALIZAR HOY' : 'GUARDAR HOY'}</Button>
        {saved && <Button variant="danger" onClick={() => { deleteWellness(today); showToast('Registro eliminado') }}>Borrar</Button>}
      </div>
      <div>
        <Label>Últimos 7 días</Label>
        <div className="flex justify-between mt-3">
          {days.map(({ d, r }, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className={`w-9 h-9 rounded-full ${LEVEL[r.level][1]} ${r.level === 'unknown' ? 'opacity-60' : ''}`} title={LEVEL[r.level][0]} />
              <span className="text-[11px] text-dim font-semibold">{['D', 'L', 'M', 'X', 'J', 'V', 'S'][d.getDay()]}</span>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] text-dim mt-3">Verde buena · ámbar media · rojo baja · gris sin registro.</p>
      </div>
    </>
  )
}
