import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.tsx'
import { installAdaptivePerformance } from './features/performance/adaptivePerformanceManager'
import {
  installRuntimeProbe,
  recordRuntimeTimeline,
} from './features/performance/runtimeResourceRegistry'
import { registerRayd8ExpressServiceWorker } from './features/pwa/registerRayd8ExpressServiceWorker'
import { isStandaloneDisplayMode } from './features/pwa/useStandaloneMode'
import { initializeUmami } from './services/umami'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in the environment.')
}

installRuntimeProbe()
installAdaptivePerformance()
recordRuntimeTimeline('load')
initializeUmami()
registerRayd8ExpressServiceWorker()

const afterSignOutUrl = isStandaloneDisplayMode() ? '/signup?source=express' : '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider afterSignOutUrl={afterSignOutUrl} publishableKey={publishableKey}>
      <App />
    </ClerkProvider>
  </StrictMode>,
)
