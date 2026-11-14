import { motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { Ambient } from '../components/Ambient'
import { Logo } from '../components/Logo'
import { readFileText } from '../lib/files'
import { useStore } from '../../store'

/** Primera ejecución: bienvenida a pantalla completa. Sin cuentas ni registro. */
export function Welcome() {
  const { updateSettings, updateProfile, importBackup, showToast } = useStore()
  const [name, setName] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const start = () => { if (name.trim()) updateProfile({ name: name.trim() }); updateSettings({ welcomed: true }) }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] overflow-hidden" role="dialog" aria-label="Bienvenida">
      <Ambient tab="welcome" strong />
      <div className="relative h-full flex flex-col px-6 pt-safe pb-safe">
        <div className="pt-4"><Logo size={26} /></div>
        <div className="flex-1" />
        <motion.h1 initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15, duration: 0.6 }} className="display text-[64px] leading-[0.9] text-shadow-soft">
          Entrena cada día —<br />supera cada límite
        </motion.h1>
        <p className="text-white/80 text-[17px] mt-4 leading-snug max-w-[320px]">Fuerza, combate y mente. Sin cuentas.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="¿Cómo te llamas? (opcional)" aria-label="Tu nombre"
          className="mt-6 h-12 rounded-full bg-white/10 ring-1 ring-inset ring-white/20 backdrop-blur-xl px-5 text-[16px] placeholder:text-white/45" />
        <div className="grid grid-cols-2 gap-3 mt-4 mb-5">
          <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ''
            if (!f) return
            const r = importBackup(await readFileText(f), 'replace')
            showToast(r.message)
            if (r.ok) updateSettings({ welcomed: true })
          }} />
          <button onClick={() => file.current?.click()} className="h-14 rounded-full bg-black/45 ring-1 ring-inset ring-white/15 backdrop-blur-xl text-[16px] font-medium active:bg-white/15">Importar copia</button>
          <button onClick={start} className="h-14 rounded-full bg-white text-black text-[16px] font-semibold active:scale-[0.985]">Empezar</button>
        </div>
      </div>
    </motion.div>
  )
}
