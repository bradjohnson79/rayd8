import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.tsx'
import { registerRayd8ExpressServiceWorker } from './features/pwa/registerRayd8ExpressServiceWorker'
import { initializeUmami } from './services/umami'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in the environment.')
}

initializeUmami()
registerRayd8ExpressServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider afterSignOutUrl="/" publishableKey={publishableKey}>
      <App />
    </ClerkProvider>
  </StrictMode>,
)
