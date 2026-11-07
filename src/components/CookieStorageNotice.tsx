'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_NOTICE_KEY = 'seamcast_storage_notice_ack_v1'

export default function CookieStorageNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_NOTICE_KEY) !== '1') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Read client storage after hydration without SSR mismatch.
        setVisible(true)
      }
    } catch {
      // Storage disabled in private browsing; skip persistent banner.
    }
  }, [])

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_NOTICE_KEY, '1')
    } catch {
      // Ignore storage write errors.
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside
      role="region"
      aria-label="Cookie and local storage notice"
      style={{
        position: 'fixed',
        right: '14px',
        left: '14px',
        bottom: '78px',
        maxWidth: '520px',
        marginLeft: 'auto',
        zIndex: 60,
        background: 'rgba(15, 23, 42, 0.97)',
        color: '#e2e8f0',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '12px 14px',
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        lineHeight: 1.45,
      }}
    >
      <p style={{ margin: 0 }}>
        SeamCast uses essential session cookies for sign-in and local browser storage for offline maps and preferences.{' '}
        <Link href="/privacy" style={{ color: '#7dd3fc', textDecoration: 'underline' }}>
          Privacy
        </Link>
        {' · '}
        <Link href="/terms" style={{ color: '#7dd3fc', textDecoration: 'underline' }}>
          Terms
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        style={{
          flexShrink: 0,
          border: '1px solid #0891b2',
          borderRadius: '8px',
          background: '#0e7490',
          color: '#f0f9ff',
          fontWeight: 700,
          fontSize: '12px',
          padding: '7px 12px',
          cursor: 'pointer',
        }}
      >
        Got it
      </button>
    </aside>
  )
}
