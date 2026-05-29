export function registerRayd8ExpressServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  if (import.meta.env.DEV) {
    return
  }

  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker.register('/rayd8-express-sw.js').catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('[RAYD8 Express] Service worker registration failed.', error)
        }
      })
    },
    { once: true },
  )
}
