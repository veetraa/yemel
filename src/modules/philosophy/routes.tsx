/** Rutas y raíz del módulo FILOSOFÍA (estoicismo y desarrollo mental). Nada de gimnasio ni de combate aquí. */
import { Header } from '../../shared/components/ui'
import { SubTabs } from '../../shared/components/SubTabs'
import { useNav, type Screen } from '../../nav'
import { EntryEditor, PhilosopherDetail, PillarDetail, ReflectionDetail } from './screens/Details'
import { FavoritesPanel, JournalPanel, PhilosophersPanel, PillarsPanel, QuotesPanel, ReflectionsPanel, TodayPanel } from './screens/Panels'

const SUBS = [
  { key: 'today', label: 'Hoy' }, { key: 'quotes', label: 'Frases' }, { key: 'philosophers', label: 'Filósofos' }, { key: 'reflections', label: 'Reflexiones' },
  { key: 'pillars', label: 'Pilares' }, { key: 'journal', label: 'Diario' }, { key: 'favorites', label: 'Favoritos' },
]

export function PhilosophyRoot() {
  const { sub, setSub } = useNav()
  const key = sub.philosophy ?? 'today'
  return (
    <div className="h-full flex flex-col">
      <Header title="Filosofía" large />
      <SubTabs id="philo" items={SUBS} value={key} onChange={(k) => setSub('philosophy', k)} />
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          {key === 'today' && <TodayPanel />}
          {key === 'quotes' && <QuotesPanel />}
          {key === 'philosophers' && <PhilosophersPanel />}
          {key === 'reflections' && <ReflectionsPanel />}
          {key === 'pillars' && <PillarsPanel />}
          {key === 'journal' && <JournalPanel />}
          {key === 'favorites' && <FavoritesPanel />}
        </div>
      </div>
    </div>
  )
}

export function renderPhilosophyScreen(s: Screen) {
  switch (s.name) {
    case 'philo.philosopher': return <PhilosopherDetail id={s.id} />
    case 'philo.reflection': return <ReflectionDetail id={s.id} />
    case 'philo.pillar': return <PillarDetail id={s.id} />
    case 'philo.entry': return <EntryEditor id={s.id} />
  }
  return null
}
