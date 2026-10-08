'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

type VitalPayload = {
  route: string
  device_class: 'mobile' | 'desktop'
  viewport_width: number
  connection_type?: string
  fcp_ms?: number
  lcp_ms?: number
  inp_ms?: number
  cls?: number
  ttfb_ms?: number
}

function round(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined
}

export default function FieldVitals() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const payload: VitalPayload = {
      route: pathname,
      device_class: window.innerWidth < 768 ? 'mobile' : 'desktop',
      viewport_width: Math.min(window.innerWidth, 4000),
      connection_type: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType,
      ttfb_ms: round(navigation?.responseStart),
    }
    let sent = false
    let lcpEntry: PerformanceEntry | undefined
    let clsValue = 0
    let inpValue = 0

    const paint = performance.getEntriesByName('first-contentful-paint')[0]
    if (paint) payload.fcp_ms = round(paint.startTime)

    const observers: PerformanceObserver[] = []
    const observe = (type: string, callback: (entry: PerformanceEntry) => void, options?: PerformanceObserverInit) => {
      try {
        const observer = new PerformanceObserver((list) => list.getEntries().forEach(callback))
        observer.observe({ type, buffered: true, ...options })
        observers.push(observer)
      } catch {
        // Unsupported metric in this browser: submit the metrics that are available.
      }
    }
    observe('largest-contentful-paint', (entry) => { lcpEntry = entry })
    observe('layout-shift', (entry) => {
      const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }
      if (!shift.hadRecentInput) clsValue += shift.value ?? 0
    })
    observe('event', (entry) => {
      const event = entry as PerformanceEntry & { duration?: number; interactionId?: number }
      if (event.interactionId) inpValue = Math.max(inpValue, event.duration ?? 0)
    }, { durationThreshold: 16 } as PerformanceObserverInit)

    const send = () => {
      if (sent) return
      sent = true
      observers.forEach((observer) => observer.disconnect())
      if (lcpEntry) payload.lcp_ms = round(lcpEntry.startTime)
      if (clsValue > 0) payload.cls = round(clsValue)
      if (inpValue > 0) payload.inp_ms = round(inpValue)
      const body = JSON.stringify(payload)
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/rum/vitals', new Blob([body], { type: 'application/json' }))
      } else {
        void fetch('/api/rum/vitals', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined)
      }
    }

    const timer = window.setTimeout(send, 10_000)
    document.addEventListener('visibilitychange', send, { once: true })
    window.addEventListener('pagehide', send, { once: true })
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', send)
      window.removeEventListener('pagehide', send)
      send()
    }
  }, [pathname])

  return null
}
