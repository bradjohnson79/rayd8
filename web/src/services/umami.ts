declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void
    }
  }
}

const RAYD8_UMAMI_WEBSITE_ID = '012f9848-b387-4594-a1e6-69fc2ac354aa'
const MAX_PENDING_EVENTS = 20
const pendingEvents: Array<{ eventData?: Record<string, unknown>; eventName: string }> = []
const trackedOnceEvents = new Set<string>()

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

function scheduleIdle(callback: () => void) {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(callback, { timeout: 4000 })
    return
  }

  window.setTimeout(callback, 1500)
}

function flushPendingEvents() {
  if (!window.umami) {
    return
  }

  while (pendingEvents.length > 0) {
    const event = pendingEvents.shift()

    if (event) {
      window.umami.track(event.eventName, event.eventData)
    }
  }
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
    script.addEventListener('load', flushPendingEvents, { once: true })
    document.head.appendChild(script)
  }

  if (document.readyState === 'complete') {
    scheduleIdle(injectUmami)
    return
  }

  window.addEventListener(
    'load',
    () => {
      scheduleIdle(injectUmami)
    },
    { once: true },
  )
}

export function trackUmamiEvent(eventName: string, eventData?: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return
  }

  if (window.umami) {
    window.umami.track(eventName, eventData)
    return
  }

  if (pendingEvents.length < MAX_PENDING_EVENTS) {
    pendingEvents.push({ eventData, eventName })
  }
}

export function trackUmamiEventOnce(
  eventName: string,
  eventData?: Record<string, unknown>,
  dedupeKey = eventName,
) {
  if (trackedOnceEvents.has(dedupeKey)) {
    return
  }

  trackedOnceEvents.add(dedupeKey)
  trackUmamiEvent(eventName, eventData)
}

export {}
