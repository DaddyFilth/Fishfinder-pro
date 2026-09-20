'use client'

import { useEffect, useState } from 'react'

export default function ApiStatusCheck() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch('https://seamcast-spots.vercel.app/api/spots?lat=34.999&lon=-97.366')
      .then(r => {
        if (r.ok) setStatus('✅ LIVE - Real data')
        else setStatus('⚠️ ERROR ' + r.status)
      })
      .catch(e => setStatus('❌ FAILED - ' + e.message))
  }, [])

  return <div style={{padding: '1rem', background: '#000', color: '#0f0', border: '1px solid #0f0'}}>
    API Status: {status}
  </div>
}
