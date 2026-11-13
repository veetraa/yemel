import { motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { Accordion, Seg } from '../../../shared/components/fields'
import { Icon } from '../../../shared/components/Icon'
import { Button, Header, Label, Row, Sheet, Toggle } from '../../../shared/components/ui'
import { copyText, readFileText, saveTextFile } from '../../../shared/lib/files'
import { loadStatus } from '../../../shared/services/fatigueService'
import { readiness } from '../../../shared/services/recoveryService'
import { GOAL_KIND_LABEL, ageOf, goalProgress } from '../../../shared/services/profileService'
import { chatGptPrompt } from '../../../shared/services/hybridImportService'
import { personalRecords, streakWeeks } from '../../gym/services/workoutService'
import { formatNumber, WEEKDAYS_SHORT } from '../../../shared/lib/utils'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'
import type { Settings } from '../../../types'
import { BodySection } from './sections/BodySection'
import { CoachSection } from './sections/CoachSection'
import { GoalsSection } from './sections/GoalsSection'
import { PersonalSection } from './sections/PersonalSection'
import { RecoverySection } from '../../../shared/components/RecoverySection'
import { SportSection } from './sections/SportSection'

export function ProfileScreen() {
  const store = useStore()
  const { profile: p, settings, updateSettings, updateProfile, routines, sessions, body, wellness, activities, weight, exportBackup, importBackup, resetAll, showToast } = store
  const { push } = useNav()
  const [open, setOpen] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [reset, setReset] = useState(false)
  const [install, setInstall] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const photo = useRef<HTMLInputElement>(null)
  const toggle = (k: string) => setOpen(open === k ? null : k)

  const age = ageOf(p)
  const goalCount = p.goals.length + (p.targetWeightKg !== undefined && !p.goals.some((g) => g.metric === 'weight') ? 1 : 0)
  const prs = personalRecords(sessions).length
  const streak = streakWeeks(sessions, p.weeklyGoal)
  const r = readiness(wellness)
  const l = loadStatus(sessions, activities)
  const goalsDone = p.goals.filter((g) => goalProgress(g, { profile: p, body, sessions }).done).length

  const doExport = async () => {
    await saveTextFile(`forma-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportBackup(), null, 2))
    showToast('Copia de seguridad lista')
  }

  return (
    <div className="scroll h-full pb-12">
      <Header title="Expediente" large />
      <div className="px-6">
        {/* Cabecera del atleta */}
        <div className="flex items-center gap-5">
          <button onClick={() => photo.current?.click()} aria-label="Cambiar foto de perfil" className="relative w-[92px] h-[92px] rounded-full bg-s2 overflow-hidden shrink-0 grid place-items-center ring-2 ring-line">
            {p.photo ? <img src={p.photo} alt="Foto de perfil" className="w-full h-full object-cover" /> : <span className="text-[34px] font-bold text-mute">{(p.name.trim()[0] ?? '·').toUpperCase()}</span>}
            <span className="absolute bottom-0 inset-x-0 bg-black/55 text-[10px] font-semibold py-0.5 text-center">{p.photo ? 'Cambiar' : 'Foto'}</span>
          </button>
          <input ref={photo} type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ''
            if (!f) return
            const { resizeImage } = await import('../../../shared/services/profileService')
            try { updateProfile({ photo: await resizeImage(f, 480) }); showToast('Foto guardada solo en este dispositivo') } catch { showToast('No se pudo leer la imagen') }
          }} />
          <div className="min-w-0">
            <div className="text-[26px] font-bold tracking-tight leading-tight truncate">{p.name.trim() || 'Atleta'}</div>
            <div className="num text-[14px] text-mute mt-1 tracking-normal">{[age !== undefined && `${age} años`, p.heightCm && `${p.heightCm} cm`, weight !== undefined && `${formatNumber(weight)} kg${p.targetWeightKg !== undefined ? ` → ${formatNumber(p.targetWeightKg)}` : ''}`].filter(Boolean).join(' · ') || 'Completa tu ficha'}</div>
            {p.mainGoal && <div className="mt-2 inline-block text-[11.5px] font-bold uppercase tracking-wider bg-accent text-black rounded-full px-2.5 py-1">{p.mainGoal}</div>}
          </div>
        </div>

        <div className="grid grid-cols-3 mt-7 divide-x divide-line">
          <Mini value={sessions.length} label="Sesiones" />
          <Mini value={streak} label="Semanas seguidas" />
          <Mini value={prs} label="Récords" />
        </div>
        {p.sports.length > 0 && <div className="flex flex-wrap gap-2 mt-5">{p.sports.map((s) => <span key={s} className="text-[12px] font-semibold text-mute bg-s2 rounded-full px-3 py-1">{s}</span>)}</div>}

        {/* Secciones */}
        <div className="mt-7 border-t border-line/70">
          <Accordion icon="user" title="Datos personales" open={open === 'personal'} onToggle={() => toggle('personal')}
            summary={[age !== undefined && `${age} años`, p.heightCm && `${p.heightCm} cm`, weight !== undefined && `${formatNumber(weight)} kg`].filter(Boolean).join(' · ')}><PersonalSection /></Accordion>
          <Accordion icon="bolt" title="Perfil deportivo" open={open === 'sport'} onToggle={() => toggle('sport')}
            summary={[p.mainGoal, p.sports.join(' + '), p.availableDays.length ? p.availableDays.map((d) => WEEKDAYS_SHORT[d]).join('') : null].filter(Boolean).join(' · ') || 'Objetivo, deportes, disponibilidad'}><SportSection /></Accordion>
          <Accordion icon="trophy" title="Objetivos físicos" open={open === 'goals'} onToggle={() => toggle('goals')}
            summary={goalCount ? `${goalCount} objetivo${goalCount > 1 ? 's' : ''}${goalsDone ? ` · ${goalsDone} cumplido${goalsDone > 1 ? 's' : ''}` : ''} · ${[...new Set(p.goals.map((g) => GOAL_KIND_LABEL[g.kind]))].join(', ')}` : 'Músculo, fuerza, resistencia, peso…'}><GoalsSection /></Accordion>
          <Accordion icon="chart" title="Historial corporal" open={open === 'body'} onToggle={() => toggle('body')}
            summary={body.length ? `${body.length} registro${body.length > 1 ? 's' : ''}${body.some((b) => b.photo) ? ' · con fotos' : ''}` : 'Peso, medidas y fotos'}><BodySection /></Accordion>
          <Accordion icon="clock" title="Recuperación y fatiga" open={open === 'recovery'} onToggle={() => toggle('recovery')}
            summary={r.level === 'unknown' ? 'Sueño, energía, fatiga, dolor' : `Hoy: recuperación ${r.level === 'good' ? 'buena' : r.level === 'moderate' ? 'media' : 'baja'}`}><RecoverySection /></Accordion>
          <Accordion icon="star" title="Entrenador" open={open === 'coach'} onToggle={() => toggle('coach')}
            summary={store.adjustment.active ? 'Hay ajustes activos para hoy' : l.level === 'unknown' ? 'Cómo usa tu perfil para adaptar el plan' : 'Sin ajustes necesarios'}><CoachSection /></Accordion>
          <Accordion icon="file" title="Privacidad y datos" open={open === 'data'} onToggle={() => toggle('data')} summary={`${routines.length} rutinas · ${sessions.length} sesiones · solo en este dispositivo`}>
            <div className="bg-s1 rounded-2xl p-4 text-[13.5px] text-mute leading-relaxed space-y-2">
              <p><b className="text-white">Tu expediente es solo tuyo.</b> No hay cuentas, ni servidores, ni análisis. Todo (incluidas fotos) vive en el almacenamiento de este iPhone y nunca se envía a nadie.</p>
              <p>{routines.length} rutinas · {sessions.length} sesiones · {body.length} registros corporales · {wellness.length} días de recuperación · {activities.length} actividades.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="md" onClick={doExport}><Icon name="download" size={17} /> Exportar</Button>
              <Button variant="secondary" size="md" onClick={() => file.current?.click()}><Icon name="upload" size={17} /> Importar</Button>
            </div>
            <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setPending(await readFileText(f)) }} />
            <p className="text-[12px] text-dim leading-snug">La copia incluye perfil, fotos e historial. Guárdala en un lugar privado (p. ej. iCloud Drive); quien tenga el archivo puede leerlo.</p>
            <Button variant="danger" size="md" className="w-full" onClick={() => setReset(true)}><Icon name="trash" size={17} /> Eliminar todos mis datos</Button>
          </Accordion>
          <Accordion icon="list" title="Ajustes de la app" open={open === 'app'} onToggle={() => toggle('app')} summary={`${settings.unit === 'kg' ? 'Kilogramos' : 'Libras'} · sonido ${settings.sound ? 'sí' : 'no'}`}>
            <Seg<Settings['unit']> value={settings.unit} onChange={(v) => updateSettings({ unit: v })} options={[{ v: 'kg', l: 'Kilogramos' }, { v: 'lb', l: 'Libras' }]} />
            <div>
              <Row><div className="flex-1"><div className="font-semibold">Sonido al terminar el descanso</div></div><Toggle on={settings.sound} onChange={(v) => updateSettings({ sound: v })} /></Row>
              <Row><div className="flex-1"><div className="font-semibold">Vibración</div><div className="text-[12.5px] text-mute">Solo en dispositivos compatibles</div></div><Toggle on={settings.vibrate} onChange={(v) => updateSettings({ vibrate: v })} /></Row>
              <Row onClick={() => push({ name: 'shared.week' })}><Icon name="clock" size={20} className="text-mute" /><span className="flex-1 font-semibold">Semana y recuperación</span><Icon name="chev" size={16} className="text-dim" /></Row>
              <Row onClick={() => push({ name: 'profile.hybridImport' })}><Icon name="upload" size={20} className="text-mute" /><span className="flex-1"><span className="font-semibold block">Importar planificación híbrida</span><span className="text-[12px] text-mute">Gym + combate + atleta desde ChatGPT</span></span><Icon name="chev" size={16} className="text-dim" /></Row>
              <Row onClick={async () => showToast((await copyText(chatGptPrompt())) ? 'Prompt copiado' : 'No se pudo copiar')}><Icon name="copy" size={20} className="text-mute" /><span className="flex-1 font-semibold">Copiar prompt híbrido para ChatGPT</span></Row>
              <Row onClick={() => setInstall(true)}><Icon name="download" size={20} className="text-mute" /><span className="flex-1 font-semibold">Instalar en la pantalla de inicio</span><Icon name="chev" size={16} className="text-dim" /></Row>
            </div>
          </Accordion>
        </div>
        <p className="text-center text-[12px] text-dim mt-8">Forma · gratis, sin cuentas ni suscripción</p>
      </div>

      <Sheet open={pending !== null} onClose={() => setPending(null)} title="Importar copia de seguridad">
        <p className="text-mute leading-relaxed">¿Quieres combinar la copia con tus datos actuales o reemplazarlos por completo?</p>
        <div className="mt-5 space-y-2">
          <Button className="w-full" onClick={() => { const x = importBackup(pending!, 'merge'); showToast(x.message); setPending(null) }}>Combinar (recomendado)</Button>
          <Button variant="danger" className="w-full" onClick={() => { const x = importBackup(pending!, 'replace'); showToast(x.message); setPending(null) }}>Reemplazar todo</Button>
          <Button variant="secondary" className="w-full" onClick={() => setPending(null)}>Cancelar</Button>
        </div>
      </Sheet>
      <Sheet open={reset} onClose={() => setReset(false)} title="¿Eliminar todos tus datos?">
        <p className="text-mute leading-relaxed">Se borrarán perfil, fotos, rutinas, historial, medidas y registros de recuperación de este dispositivo. No se puede deshacer; exporta antes una copia si quieres conservarlos.</p>
        <div className="mt-5 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setReset(false)}>Cancelar</Button><Button variant="danger" className="flex-1" onClick={async () => { await resetAll(); setReset(false); showToast('Datos eliminados') }}>Eliminar</Button></div>
      </Sheet>
      <Sheet open={install} onClose={() => setInstall(false)} title="Instalar en el iPhone">
        <ol className="space-y-4 text-[15.5px] leading-relaxed">
          <li><b>1.</b> Abre esta página en <b>Safari</b>.</li>
          <li><b>2.</b> Pulsa el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>
          <li><b>3.</b> Elige <b>«Añadir a pantalla de inicio»</b> y confirma.</li>
          <li><b>4.</b> Ábrela desde el icono: funciona a pantalla completa y <b>sin conexión</b>.</li>
        </ol>
        <p className="text-[13px] text-mute mt-5 leading-relaxed">Instalada en la pantalla de inicio, iOS no borra tus datos por inactividad. Aun así, exporta copias de vez en cuando.</p>
      </Sheet>
    </div>
  )
}

function Mini({ value, label }: { value: number; label: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="px-3 first:pl-0 last:pr-0">
      <div className="num text-[26px] font-bold leading-none">{value}</div>
      <Label className="mt-1.5 !text-[10px]">{label}</Label>
    </motion.div>
  )
}
