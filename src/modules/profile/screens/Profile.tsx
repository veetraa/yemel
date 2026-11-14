import { motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { Accordion, Seg, SubLabel } from '../../../shared/components/fields'
import { Icon } from '../../../shared/components/Icon'
import { Hint } from '../../../shared/components/Hint'
import { Button, Header, Label, Row, Sheet, Toggle } from '../../../shared/components/ui'
import { copyText, readFileText, saveTextFile } from '../../../shared/lib/files'
import { loadStatus } from '../../../shared/services/fatigueService'
import { readiness } from '../../../shared/services/recoveryService'
import { GOAL_KIND_LABEL, ageOf, goalProgress, resizeImage } from '../../../shared/services/profileService'
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
  const [credits, setCredits] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const photo = useRef<HTMLInputElement>(null)
  const bg = useRef<HTMLInputElement>(null)
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
            {p.mainGoal && <div className="mt-2 inline-block max-w-full text-[11.5px] font-semibold leading-snug bg-white/12 text-white ring-1 ring-inset ring-white/20 backdrop-blur-xl rounded-2xl px-3 py-1.5 line-clamp-2">{p.mainGoal}</div>}
          </div>
        </div>

        <div className="grid grid-cols-3 mt-7 divide-x divide-line">
          <Mini value={sessions.length} label="Sesiones" />
          <Mini value={streak} label="Semanas seguidas" />
          <Mini value={prs} label="Récords" />
        </div>
        {p.sports.length > 0 && <div className="flex flex-wrap gap-2 mt-5">{p.sports.map((s) => <span key={s} className="text-[12px] font-semibold text-mute bg-s2 rounded-full px-3 py-1">{s}</span>)}</div>}

        <Hint id="profile" className="mt-6">Edita tus datos en las secciones de abajo. Tu progreso está en el botón «Progreso».</Hint>
        <Button variant="secondary" size="md" className="w-full mt-3" onClick={() => push({ name: 'profile.progress' })}><Icon name="chart" size={18} /> Progreso</Button>

        {/* Secciones */}
        <div className="mt-5 border-t border-line/70">
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
            summary={store.adjustment.active ? 'Hay ajustes activos para hoy' : l.level === 'unknown' ? 'Estado' : 'Sin ajustes'}><CoachSection /></Accordion>
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
            <p className="text-[12px] text-dim leading-snug">La copia incluye tus datos y fotos. Guárdala en un lugar privado.</p>
            <Button variant="danger" size="md" className="w-full" onClick={() => setReset(true)}><Icon name="trash" size={17} /> Eliminar todos mis datos</Button>
          </Accordion>
          <Accordion icon="list" title="Ajustes de la app" open={open === 'app'} onToggle={() => toggle('app')} summary={`${settings.unit === 'kg' ? 'Kilogramos' : 'Libras'} · sonido ${settings.sound ? 'sí' : 'no'}`}>
            <div>
              <SubLabel>Fondo de la app</SubLabel>
              <input ref={bg} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { updateSettings({ bgPhoto: await resizeImage(f, 1100, 0.8) }); showToast('Fondo guardado solo en este iPhone') } catch { showToast('No se pudo leer la imagen') } }} />
              <div className="flex gap-2">
                <Button variant="secondary" size="md" className="flex-1" onClick={() => bg.current?.click()}>{settings.bgPhoto ? 'Cambiar foto' : 'Usar mi foto'}</Button>
                {settings.bgPhoto && <Button variant="ghost" size="md" onClick={() => updateSettings({ bgPhoto: undefined })}>Automático</Button>}
              </div>
              <p className="text-[12px] text-dim mt-2 leading-snug">Se guarda solo en este dispositivo.</p>
            </div>
            <Seg<Settings['unit']> value={settings.unit} onChange={(v) => updateSettings({ unit: v })} options={[{ v: 'kg', l: 'Kilogramos' }, { v: 'lb', l: 'Libras' }]} />
            <div>
              <Row><div className="flex-1"><div className="font-semibold">Sonido al terminar el descanso</div></div><Toggle on={settings.sound} onChange={(v) => updateSettings({ sound: v })} /></Row>
              <Row><div className="flex-1"><div className="font-semibold">Vibración</div><div className="text-[12.5px] text-mute">Solo en dispositivos compatibles</div></div><Toggle on={settings.vibrate} onChange={(v) => updateSettings({ vibrate: v })} /></Row>
              <Row onClick={() => push({ name: 'shared.week' })}><Icon name="clock" size={20} className="text-mute" /><span className="flex-1 font-semibold">Semana y recuperación</span><Icon name="chev" size={16} className="text-dim" /></Row>
              <Row onClick={() => updateSettings({ setupDismissed: false })}><Icon name="list" size={20} className="text-mute" /><span className="flex-1 font-semibold">Mostrar primeros pasos</span><Icon name="chev" size={16} className="text-dim" /></Row>
              <Row onClick={() => { updateSettings({ hintsSeen: [] }); showToast('Ayudas activadas') }}><Icon name="info" size={20} className="text-mute" /><span className="flex-1 font-semibold">Volver a mostrar las ayudas</span><Icon name="chev" size={16} className="text-dim" /></Row>
              <Row onClick={() => push({ name: 'profile.hybridImport' })}><Icon name="upload" size={20} className="text-mute" /><span className="flex-1"><span className="font-semibold block">Importar planificación híbrida</span><span className="text-[12px] text-mute">Gym + combate + atleta desde ChatGPT</span></span><Icon name="chev" size={16} className="text-dim" /></Row>
              <Row onClick={async () => showToast((await copyText(chatGptPrompt())) ? 'Prompt copiado' : 'No se pudo copiar')}><Icon name="copy" size={20} className="text-mute" /><span className="flex-1 font-semibold">Copiar prompt híbrido para ChatGPT</span></Row>
              <Row onClick={() => setInstall(true)}><Icon name="download" size={20} className="text-mute" /><span className="flex-1 font-semibold">Instalar en la pantalla de inicio</span><Icon name="chev" size={16} className="text-dim" /></Row>
            </div>
          </Accordion>
        </div>
        <button onClick={() => setCredits(true)} className="block mx-auto text-center text-[12px] text-dim mt-8 active:text-white">Forma · Créditos y licencias</button>
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
        <p className="text-mute leading-relaxed">Se borrarán todos tus datos de este dispositivo. No se puede deshacer.</p>
        <div className="mt-5 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setReset(false)}>Cancelar</Button><Button variant="danger" className="flex-1" onClick={async () => { await resetAll(); setReset(false); showToast('Datos eliminados') }}>Eliminar</Button></div>
      </Sheet>
      <Sheet open={credits} onClose={() => setCredits(false)} title="Créditos y licencias">
        <div className="space-y-4 text-[14px] leading-relaxed text-mute">
          <p><a className="text-white font-semibold underline underline-offset-4" href="https://repdb.co" target="_blank" rel="noopener nofollow">Exercise data by RepDB (repdb.co)</a><br />Ilustraciones de inicio y final y datos anatómicos de los ejercicios vinculados. Licencia gratuita con atribución, para uso dentro de aplicaciones.</p>
          <p><a className="text-white font-semibold underline underline-offset-4" href="https://github.com/kinetic-place/exercises-db" target="_blank" rel="noopener">Kinetic Exercises Database</a> · MIT<br />Nombres, músculos, equipamiento, dificultad y guías de ejecución en español.</p>
          <p><a className="text-white font-semibold underline underline-offset-4" href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">Free Exercise DB</a> · Unlicense<br />Fotos de referencia, cargadas bajo demanda.</p>
          <p><a className="text-white font-semibold underline underline-offset-4" href="https://gymvisual.com/" target="_blank" rel="noopener nofollow">© Gym visual</a><br />Animaciones de los ejercicios, vía exercises-dataset (hasaneyldrm). Los medios son propiedad de Gym visual.</p>
          <p>Los vídeos de demostración no se incluyen: no se ha podido verificar el derecho de redistribución de los vídeos disponibles. Puedes añadir los tuyos en cada ejercicio.</p>
        </div>
      </Sheet>

      <Sheet open={install} onClose={() => setInstall(false)} title="Instalar en el iPhone">
        <ol className="space-y-4 text-[15.5px] leading-relaxed">
          <li><b>1.</b> Abre esta página en <b>Safari</b>.</li>
          <li><b>2.</b> Pulsa el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>
          <li><b>3.</b> Elige <b>«Añadir a pantalla de inicio»</b> y confirma.</li>
          <li><b>4.</b> Ábrela desde el icono: funciona a pantalla completa y <b>sin conexión</b>.</li>
        </ol>
        <p className="text-[13px] text-mute mt-5 leading-relaxed">Exporta copias de vez en cuando.</p>
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
