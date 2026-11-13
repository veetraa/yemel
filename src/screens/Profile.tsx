import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Button, Header, Label, Row, Sheet, Toggle } from '../components/ui'
import { copyText, readFileText, saveTextFile } from '../lib/files'
import { chatGptPrompt } from '../lib/prompt'
import { useNav } from '../nav'
import { useStore } from '../store'
import type { Settings } from '../types'

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex p-1 bg-s2 rounded-xl">
      {options.map((o) => (
        <button key={String(o.v)} onClick={() => onChange(o.v)} className={`flex-1 h-9 rounded-lg text-[13px] font-semibold transition ${value === o.v ? 'bg-s3 text-white' : 'text-mute'}`}>{o.l}</button>
      ))}
    </div>
  )
}

export function ProfileScreen() {
  const { settings, updateSettings, routines, sessions, exportBackup, importBackup, resetAll, showToast } = useStore()
  const { push } = useNav()
  const [pending, setPending] = useState<string | null>(null)
  const [reset, setReset] = useState(false)
  const [install, setInstall] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const [bw, setBw] = useState<string | null>(null)

  const doExport = async () => {
    const stamp = new Date().toISOString().slice(0, 10)
    await saveTextFile(`forma-backup-${stamp}.json`, JSON.stringify(exportBackup(), null, 2))
    showToast('Copia de seguridad lista')
  }

  return (
    <div className="scroll h-full pb-10">
      <Header title="Perfil" large />
      <div className="px-6">
        <Label className="mt-2">Tú</Label>
        <div className="mt-3 space-y-4">
          <label className="block">
            <div className="text-[13px] text-mute mb-1.5">Nombre</div>
            <input value={settings.name} onChange={(e) => updateSettings({ name: e.target.value })} placeholder="¿Cómo te llamas?" className="w-full bg-s2 rounded-xl h-12 px-4 font-semibold placeholder:text-dim" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[13px] text-mute mb-1.5">Peso corporal (kg)</div>
              <input inputMode="decimal" value={bw ?? (settings.bodyWeight ?? '')} placeholder="—" onBlur={() => setBw(null)}
                onChange={(e) => { const t = e.target.value.replace(',', '.'); if (!/^\d*\.?\d*$/.test(t)) return; setBw(t); updateSettings({ bodyWeight: t && parseFloat(t) > 0 ? parseFloat(t) : undefined }) }}
                className="num w-full bg-s2 rounded-xl h-12 px-4 font-semibold placeholder:text-dim" />
            </label>
            <div>
              <div className="text-[13px] text-mute mb-1.5">Objetivo semanal</div>
              <div className="flex items-center bg-s2 rounded-xl h-12">
                <button className="w-12 h-full grid place-items-center text-mute" aria-label="Menos" onClick={() => updateSettings({ weeklyGoal: Math.max(1, settings.weeklyGoal - 1) })}><Icon name="minus" size={16} /></button>
                <div className="flex-1 text-center num font-bold">{settings.weeklyGoal} <span className="text-mute text-xs font-semibold">días</span></div>
                <button className="w-12 h-full grid place-items-center text-mute" aria-label="Más" onClick={() => updateSettings({ weeklyGoal: Math.min(7, settings.weeklyGoal + 1) })}><Icon name="plus" size={16} /></button>
              </div>
            </div>
          </div>
          <div><div className="text-[13px] text-mute mb-1.5">Experiencia (afina los pesos sugeridos)</div>
            <Seg<Settings['experience']> value={settings.experience} onChange={(v) => updateSettings({ experience: v })} options={[{ v: 'beginner', l: 'Principiante' }, { v: 'intermediate', l: 'Intermedio' }, { v: 'advanced', l: 'Avanzado' }]} /></div>
          <div><div className="text-[13px] text-mute mb-1.5">Unidades</div>
            <Seg<Settings['unit']> value={settings.unit} onChange={(v) => updateSettings({ unit: v })} options={[{ v: 'kg', l: 'Kilogramos' }, { v: 'lb', l: 'Libras' }]} /></div>
        </div>

        <Label className="mt-10">Temporizador</Label>
        <div className="mt-1">
          <Row><div className="flex-1"><div className="font-semibold">Sonido al terminar</div><div className="text-[12.5px] text-mute">Tres pitidos al acabar el descanso</div></div><Toggle on={settings.sound} onChange={(v) => updateSettings({ sound: v })} /></Row>
          <Row><div className="flex-1"><div className="font-semibold">Vibración</div><div className="text-[12.5px] text-mute">Solo en dispositivos compatibles</div></div><Toggle on={settings.vibrate} onChange={(v) => updateSettings({ vibrate: v })} /></Row>
        </div>

        <Label className="mt-10">Datos y copias de seguridad</Label>
        <p className="text-[13.5px] text-mute leading-relaxed mt-2">Todo se guarda solo en este dispositivo ({routines.length} rutinas · {sessions.length} sesiones). Exporta una copia de vez en cuando.</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button variant="secondary" size="md" onClick={doExport}><Icon name="download" size={17} /> Exportar</Button>
          <Button variant="secondary" size="md" onClick={() => file.current?.click()}><Icon name="upload" size={17} /> Importar</Button>
        </div>
        <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setPending(await readFileText(f)) }} />

        <Label className="mt-10">Ayuda</Label>
        <div className="mt-1">
          <Row onClick={() => push({ name: 'import' })}><Icon name="upload" size={20} className="text-mute" /><span className="flex-1 font-semibold">Importar rutina de ChatGPT</span><Icon name="chev" size={16} className="text-dim" /></Row>
          <Row onClick={async () => showToast((await copyText(chatGptPrompt())) ? 'Prompt copiado' : 'No se pudo copiar')}><Icon name="copy" size={20} className="text-mute" /><span className="flex-1 font-semibold">Copiar prompt para ChatGPT</span></Row>
          <Row onClick={() => setInstall(true)}><Icon name="download" size={20} className="text-mute" /><span className="flex-1 font-semibold">Instalar en la pantalla de inicio</span><Icon name="chev" size={16} className="text-dim" /></Row>
        </div>
        <Button variant="danger" size="md" className="w-full mt-8" onClick={() => setReset(true)}><Icon name="trash" size={17} /> Borrar todos los datos</Button>
        <p className="text-center text-[12px] text-dim mt-8">Forma · gratis, sin cuentas ni suscripción</p>
      </div>

      <Sheet open={pending !== null} onClose={() => setPending(null)} title="Importar copia de seguridad">
        <p className="text-mute leading-relaxed">¿Quieres combinar la copia con tus datos actuales o reemplazarlos por completo?</p>
        <div className="mt-5 space-y-2">
          <Button className="w-full" onClick={() => { const r = importBackup(pending!, 'merge'); showToast(r.message); setPending(null) }}>Combinar (recomendado)</Button>
          <Button variant="danger" className="w-full" onClick={() => { const r = importBackup(pending!, 'replace'); showToast(r.message); setPending(null) }}>Reemplazar todo</Button>
          <Button variant="secondary" className="w-full" onClick={() => setPending(null)}>Cancelar</Button>
        </div>
      </Sheet>
      <Sheet open={reset} onClose={() => setReset(false)} title="¿Borrar todo?">
        <p className="text-mute leading-relaxed">Se eliminarán rutinas, historial y ajustes de este dispositivo. No se puede deshacer; exporta antes una copia si quieres conservarlos.</p>
        <div className="mt-5 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setReset(false)}>Cancelar</Button><Button variant="danger" className="flex-1" onClick={async () => { await resetAll(); setReset(false); showToast('Datos borrados') }}>Borrar</Button></div>
      </Sheet>
      <Sheet open={install} onClose={() => setInstall(false)} title="Instalar en el iPhone">
        <ol className="space-y-4 text-[15.5px] leading-relaxed">
          <li><b>1.</b> Abre esta página en <b>Safari</b>.</li>
          <li><b>2.</b> Pulsa el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>
          <li><b>3.</b> Elige <b>«Añadir a pantalla de inicio»</b> y confirma.</li>
          <li><b>4.</b> Ábrela desde el icono: funciona a pantalla completa y <b>sin conexión</b>.</li>
        </ol>
        <p className="text-[13px] text-mute mt-5 leading-relaxed">Consejo: Safari puede borrar datos de webs que no se usan en 7 días, pero no si están instaladas en la pantalla de inicio. Aun así, exporta copias de vez en cuando.</p>
      </Sheet>
    </div>
  )
}
