declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void
    }
  }
}

const RAYD8_UMAMI_WEBSITE_ID = '012f9848-b387-4594-a1e6-69fc2ac354aa'

function getUmamiScriptUrl() {
  const baseUrl = import.meta.env.VITE_UMAMI_BASE_URL?.trim() || 'https://cloud.umami.is'
  return (
    import.meta.env.VITE_UMAMI_SCRIPT_URL?.trim() ||
    `${baseUrl.replace(/\/+$/, '').replace(/\/api$/, '')}/script.js`
  )
}

function hasExistingUmamiScript() {
  return Boolean(
    document.querySelector('script[data-r8-umami="true"]') ||
      document.querySelector('script[src*="umami"][data-website-id]'),
  )
}

export function initializeUmami() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID?.trim() || RAYD8_UMAMI_WEBSITE_ID

  if (!websiteId || hasExistingUmamiScript()) {
    return
  }

  const injectUmami = () => {
    if (hasExistingUmamiScript()) {
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.defer = true
    script.src = getUmamiScriptUrl()
    script.setAttribute('data-website-id', websiteId)
    script.setAttribute('data-r8-umami', 'true')
    document.head.appendChild(script)
  }

  if (document.readyState === 'complete') {
    window.requestIdleCallback?.(injectUmami, { timeout: 4000 }) ?? window.setTimeout(injectUmami, 1500)
    return
  }

  window.addEventListener(
    'load',
    () => {
      window.requestIdleCallback?.(injectUmami, { timeout: 4000 }) ?? window.setTimeout(injectUmami, 1500)
    },
    { once: true },
  )
}

export function trackUmamiEvent(eventName: string, eventData?: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return
  }

  window.umami?.track(eventName, eventData)
}

export {}
