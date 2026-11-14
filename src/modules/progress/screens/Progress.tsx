/**
 * PROGRESO — estadísticas SEPARADAS por disciplina:
 * General (historial de todo), Gym, Combat y Cuerpo (evolución física).
 */
import { useState } from 'react'
import { Header } from '../../../shared/components/ui'
import { SubTabs } from '../../../shared/components/SubTabs'
import { useNav } from '../../../nav'
import { CombatProgress } from '../../combat/screens/CombatProgress'
import { GymProgress } from '../../gym/screens/GymProgress'
import { BodySection } from '../../profile/screens/sections/BodySection'
import { GeneralProgress } from './GeneralProgress'

const SUBS = [{ key: 'general', label: 'General' }, { key: 'gym', label: 'Gym' }, { key: 'combat', label: 'Combat' }, { key: 'body', label: 'Cuerpo' }]

export function ProgressScreen() {
  const { pop } = useNav()
  const [key, setKey] = useState('general')
  return (
    <div className="h-full flex flex-col">
      <Header title="Progreso" large onBack={pop} />
      <SubTabs id="progress" items={SUBS} value={key} onChange={(k) => setKey(k)} />
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          {key === 'general' && <GeneralProgress />}
          {key === 'gym' && <GymProgress />}
          {key === 'combat' && <CombatProgress />}
          {key === 'body' && <div className="scroll h-full pb-10"><div className="px-6 pt-5 space-y-5"><BodySection /></div></div>}
        </div>
      </div>
    </div>
  )
}
