import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { StoreProvider } from './store'
import { NavProvider } from './nav'
import { CombatMediaProvider } from './modules/combat/store'
import { PhilosophyProvider } from './modules/philosophy/store'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <CombatMediaProvider>
        <PhilosophyProvider>
          <NavProvider>
            <App />
          </NavProvider>
        </PhilosophyProvider>
      </CombatMediaProvider>
    </StoreProvider>
  </StrictMode>,
)
