/** Rutas y raíz del módulo COMBAT (deportes de contacto). Nada de musculación ni de filosofía aquí. */
import { Header } from '../../shared/components/ui'
import { SubTabs } from '../../shared/components/SubTabs'
import { ImportScreen } from '../../shared/screens/ImportScreen'
import { useNav, type Screen } from '../../nav'
import { COMBAT_SECTIONS } from './services/combatService'
import { SPORT_SHORT, isSport } from './services/combatLibraryService'
import { DisciplinePanel } from './screens/DisciplinePanel'
import { TechniqueDetail, TrainingDetail } from './screens/Detail'
import { CombatOverview } from './screens/Overview'

const SUBS = [{ key: 'overview', label: 'Resumen' }, ...COMBAT_SECTIONS.map((s) => ({ key: s, label: SPORT_SHORT[s] }))]

export function CombatRoot() {
  const { sub, setSub } = useNav()
  const key = sub.combat ?? 'overview'
  return (
    <div className="h-full flex flex-col">
      <Header title="Combat" large />
      <SubTabs id="combat" items={SUBS} value={key} onChange={(k) => setSub('combat', k)} />
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          {key === 'overview' && <CombatOverview />}
          {isSport(key) && <DisciplinePanel key={key} sport={key} />}
        </div>
      </div>
    </div>
  )
}

export function renderCombatScreen(s: Screen) {
  switch (s.name) {
    case 'combat.technique': return <TechniqueDetail sport={s.sport} id={s.id} />
    case 'combat.training': return <TrainingDetail sport={s.sport} id={s.id} />
    case 'combat.import': return <ImportScreen scope="combat" />
  }
  return null
}
