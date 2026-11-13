import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Icon } from './components/Icon'
import { useNav, type Screen, type Tab } from './nav'
import { useStore } from './store'
import { HomeScreen } from './screens/Home'
import { RoutinesScreen } from './screens/Routines'
import { TrainScreen } from './screens/Train'
import { ProgressScreen } from './screens/Progress'
import { ProfileScreen } from './screens/Profile'
import { RoutineDetail } from './screens/RoutineDetail'
import { RoutineEditorScreen } from './screens/RoutineEditorScreen'
import { ImportScreen } from './screens/Import'
import { LibraryScreen, ExerciseDetail } from './screens/Library'
import { SessionDetail, SummaryScreen } from './screens/SessionDetail'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'routines', label: 'Rutinas', icon: 'list' },
  { id: 'train', label: 'Entrenar', icon: 'bolt' },
  { id: 'progress', label: 'Progreso', icon: 'chart' },
  { id: 'profile', label: 'Perfil', icon: 'user' },
]

function renderScreen(s: Screen) {
  switch (s.name) {
    case 'routine': return <RoutineDetail id={s.id} />
    case 'editRoutine': return <RoutineEditorScreen id={s.id} />
    case 'import': return <ImportScreen />
    case 'library': return <LibraryScreen />
    case 'exercise': return <ExerciseDetail id={s.id} />
    case 'session': return <SessionDetail id={s.id} />
    case 'summary': return <SummaryScreen id={s.id} />
  }
}

export default function App() {
  const { ready, active, toast } = useStore()
  const { tab, setTab, stack } = useNav()
  const top = stack[stack.length - 1]

  useEffect(() => {
    // Evita el "rubber band" del documento en iOS
    const prevent = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest('.scroll, textarea, input')) return
      e.preventDefault()
    }
    document.addEventListener('touchmove', prevent, { passive: false })
    return () => document.removeEventListener('touchmove', prevent)
  }, [])

  if (!ready) return <div className="fixed inset-0 bg-bg" />

  return (
    <div className="fixed inset-0 flex flex-col bg-bg overflow-hidden">
      <main className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="absolute inset-0">
            {tab === 'home' && <HomeScreen />}
            {tab === 'routines' && <RoutinesScreen />}
            {tab === 'train' && <TrainScreen />}
            {tab === 'progress' && <ProgressScreen />}
            {tab === 'profile' && <ProfileScreen />}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {top && (
            <motion.div key={stack.length + top.name + ('id' in top ? top.id : '')} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 34, stiffness: 340 }} className="absolute inset-0 z-30 bg-bg shadow-[-20px_0_40px_rgba(0,0,0,.5)]">
              {renderScreen(top)}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="shrink-0 z-40 bg-bg/95 backdrop-blur border-t border-line/70 pb-safe">
        <div className="flex h-[60px]">
          {TABS.map((t) => {
            const on = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${on ? 'text-white' : 'text-dim'}`}>
                <span className="relative">
                  <Icon name={t.icon} size={23} stroke={on ? 2.2 : 1.8} />
                  {t.id === 'train' && active && <span className="absolute -top-0.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />}
                </span>
                <span className="text-[10.5px] font-semibold tracking-wide">{t.label}</span>
                {on && <motion.span layoutId="tabdot" className="absolute top-0 h-[2px] w-8 bg-accent rounded-full" />}
              </button>
            )
          })}
        </div>
      </nav>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-[96px] z-[60] bg-white text-black text-sm font-semibold px-4 py-2.5 rounded-full shadow-xl max-w-[88vw] text-center">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
