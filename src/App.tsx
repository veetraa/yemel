import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Icon } from './shared/components/Icon'
import { useNav, type Screen, type Tab } from './nav'
import { useStore } from './store'
import { HomeScreen } from './modules/home/screens/Home'
import { GymRoot, renderGymScreen } from './modules/gym/routes'
import { CombatRoot, renderCombatScreen } from './modules/combat/routes'
import { PhilosophyRoot, renderPhilosophyScreen } from './modules/philosophy/routes'
import { ProgressScreen } from './modules/progress/screens/Progress'
import { ProfileScreen } from './modules/profile/screens/Profile'
import { ImportScreen } from './shared/screens/ImportScreen'
import { WeekOverview } from './shared/screens/WeekOverview'
import { MobilityScreen } from './shared/screens/Mobility'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'gym', label: 'Gym', icon: 'gym' },
  { id: 'combat', label: 'Combat', icon: 'glove' },
  { id: 'philosophy', label: 'Filosofía', icon: 'column' },
  { id: 'progress', label: 'Progreso', icon: 'chart' },
  { id: 'profile', label: 'Perfil', icon: 'user' },
]

/** Cada módulo renderiza solo sus rutas (prefijo `gym.`, `combat.`, `philo.`). */
function renderScreen(s: Screen) {
  if (s.name.startsWith('gym.')) return renderGymScreen(s)
  if (s.name.startsWith('combat.')) return renderCombatScreen(s)
  if (s.name.startsWith('philo.')) return renderPhilosophyScreen(s)
  switch (s.name) {
    case 'shared.week': return <WeekOverview />
    case 'shared.mobility': return <MobilityScreen />
    case 'profile.hybridImport': return <ImportScreen scope="hybrid" />
  }
  return null
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
            {tab === 'gym' && <GymRoot />}
            {tab === 'combat' && <CombatRoot />}
            {tab === 'philosophy' && <PhilosophyRoot />}
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

      <nav aria-label="Navegación principal" className="shrink-0 z-40 bg-bg/95 backdrop-blur border-t border-line/70 pb-safe pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <div className="flex h-[54px]">
          {TABS.map((t) => {
            const on = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} aria-label={t.label} aria-current={on ? 'page' : undefined} className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-[3px] transition-colors ${on ? 'text-white' : 'text-dim'}`}>
                <span className="relative">
                  <Icon name={t.icon} size={22} stroke={on ? 2.1 : 1.7} />
                  {t.id === 'gym' && active && <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-accent animate-pulse" />}
                </span>
                <span className="text-[9.5px] font-semibold tracking-wide leading-none">{t.label}</span>
                {on && <motion.span layoutId="tabdot" className="absolute top-0 h-[2px] w-7 bg-accent rounded-full" />}
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
