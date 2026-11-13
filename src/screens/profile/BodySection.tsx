import { useRef, useState } from 'react'
import { LineChart } from '../../components/Charts'
import { Icon } from '../../components/Icon'
import { NumInput, TextInput } from '../../components/fields'
import { Button, Label, Sheet } from '../../components/ui'
import { METRICS, METRIC_LABEL, METRIC_UNIT, bodySeries, resizeImage } from '../../services/profileService'
import { dateKey } from '../../lib/utils'
import { formatDateShort, formatNumber, uid } from '../../lib/utils'
import { useStore } from '../../store'
import type { BodyEntry, BodyMetric } from '../../types'

type Draft = Partial<Record<BodyMetric, number>> & { date: string; photo?: string; note: string }
const blank = (): Draft => ({ date: dateKey(), note: '' })

export function BodySection() {
  const { body, saveBody, deleteBody, showToast } = useStore()
  const [metric, setMetric] = useState<BodyMetric>('weight')
  const [open, setOpen] = useState(false)
  const [d, setD] = useState<Draft>(blank())
  const [photo, setPhoto] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const series = bodySeries(body, metric)
  const unit = METRIC_UNIT[metric]
  const photos = body.filter((b) => b.photo)
  const delta = series.length > 1 ? series[series.length - 1].v - series[0].v : 0
  const hasAny = METRICS.some((m) => d[m] !== undefined) || !!d.photo

  const save = () => {
    const e: BodyEntry = { id: uid(), ts: Math.min(new Date(`${d.date}T12:00:00`).getTime(), Date.now()) }
    for (const m of METRICS) if (d[m] !== undefined) e[m] = d[m]
    if (d.photo) e.photo = d.photo
    if (d.note.trim()) e.note = d.note.trim()
    saveBody(e)
    setOpen(false); setD(blank()); showToast('Registro guardado')
  }
  const summary = (b: BodyEntry) => METRICS.filter((m) => b[m] !== undefined).map((m) => `${METRIC_LABEL[m]} ${formatNumber(b[m]!)} ${METRIC_UNIT[m]}`).join(' · ')

  return (
    <>
      <div className="flex gap-2 overflow-x-auto scroll -mx-6 px-6">
        {METRICS.map((m) => {
          const n = bodySeries(body, m).length
          return <button key={m} onClick={() => setMetric(m)} aria-pressed={metric === m} className={`h-9 px-3.5 rounded-full text-[13.5px] font-semibold whitespace-nowrap ${metric === m ? 'bg-white text-black' : 'bg-s2 text-mute'}`}>{METRIC_LABEL[m]}{n > 0 && <span className="ml-1.5 text-[11px] opacity-60">{n}</span>}</button>
        })}
      </div>
      {series.length ? (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="num text-[34px] font-bold leading-none">{formatNumber(series[series.length - 1].v)}</span>
            <span className="text-mute text-sm font-semibold">{unit} · {formatDateShort(series[series.length - 1].ts)}</span>
            {series.length > 1 && <span className={`ml-auto text-sm font-bold ${delta === 0 ? 'text-mute' : 'text-white'}`}>{delta > 0 ? '+' : ''}{formatNumber(delta)} {unit}</span>}
          </div>
          <div className="mt-3"><LineChart unit={unit} points={series} /></div>
        </div>
      ) : (
        <p className="text-[14px] text-mute leading-relaxed bg-s1 rounded-2xl p-4">Aún no hay mediciones de {METRIC_LABEL[metric].toLowerCase()}. Solo se muestran los datos que tú registres.</p>
      )}
      <Button variant="secondary" size="md" className="w-full" onClick={() => setOpen(true)}><Icon name="plus" size={18} /> Registrar medidas</Button>

      {photos.length > 0 && (
        <div>
          <Label>Fotos de evolución</Label>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {photos.slice(0, 8).map((b) => <button key={b.id} onClick={() => setPhoto(b.photo!)} className="aspect-[3/4] rounded-xl overflow-hidden bg-s2 relative"><img src={b.photo} alt={`Foto del ${formatDateShort(b.ts)}`} className="w-full h-full object-cover" /><span className="absolute bottom-0 inset-x-0 text-[10px] font-semibold bg-black/60 py-0.5 text-center">{formatDateShort(b.ts)}</span></button>)}
          </div>
          {photos.length > 1 && (
            <button onClick={() => setPhoto('compare')} className="mt-3 text-[13px] font-semibold text-accent">Comparar primera y última</button>
          )}
        </div>
      )}

      {body.length > 0 && (
        <div>
          <Label>Registros</Label>
          <div className="mt-1">
            {body.slice(0, 8).map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-3 border-b border-line/60 last:border-0">
                {b.photo && <img src={b.photo} alt="" className="w-9 h-12 rounded-md object-cover" />}
                <div className="flex-1 min-w-0"><div className="text-[12px] text-mute font-semibold">{formatDateShort(b.ts)}</div><div className="text-[14px] leading-snug">{summary(b) || 'Solo foto'}</div>{b.note && <div className="text-[12px] text-dim truncate">{b.note}</div>}</div>
                <button aria-label="Eliminar registro" onClick={() => deleteBody(b.id)} className="w-9 h-9 grid place-items-center text-dim"><Icon name="trash" size={17} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Registrar medidas">
        <p className="text-[13.5px] text-mute leading-relaxed">Rellena solo lo que hayas medido: lo que dejes vacío no se guarda.</p>
        <div className="space-y-3 mt-4">
          <TextInput label="Fecha" type="date" value={d.date} onChange={(v) => setD({ ...d, date: v || dateKey() })} />
          <div className="grid grid-cols-2 gap-3">
            {METRICS.map((m) => <NumInput key={m} label={METRIC_LABEL[m]} unit={METRIC_UNIT[m]} decimal value={d[m]} max={m === 'weight' ? 400 : 250} onChange={(n) => setD({ ...d, [m]: n })} />)}
          </div>
          <TextInput label="Nota (opcional)" value={d.note} onChange={(v) => setD({ ...d, note: v })} placeholder="Ayunas, tras entrenar…" />
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) try { setD({ ...d, photo: await resizeImage(f, 900) }) } catch { showToast('No se pudo leer la imagen') } }} />
          <div className="flex gap-2 items-center">
            <Button variant="secondary" size="md" className="flex-1" onClick={() => file.current?.click()}>{d.photo ? 'Cambiar foto' : 'Añadir foto (opcional)'}</Button>
            {d.photo && <img src={d.photo} alt="Vista previa" className="w-11 h-14 rounded-lg object-cover" />}
          </div>
          <Button className="w-full" disabled={!hasAny} onClick={save}>GUARDAR</Button>
        </div>
      </Sheet>

      <Sheet open={photo !== null} onClose={() => setPhoto(null)}>
        {photo === 'compare' && photos.length > 1 ? (
          <div className="grid grid-cols-2 gap-3">
            {[photos[photos.length - 1], photos[0]].map((b) => <div key={b.id}><img src={b.photo} alt="" className="rounded-2xl w-full aspect-[3/4] object-cover" /><div className="text-center text-[12px] text-mute mt-1.5 font-semibold">{formatDateShort(b.ts)}</div></div>)}
          </div>
        ) : photo ? <img src={photo} alt="Foto de evolución" className="rounded-2xl w-full max-h-[70dvh] object-contain" /> : null}
      </Sheet>
    </>
  )
}
