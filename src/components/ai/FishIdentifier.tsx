'use client'

/* eslint-disable @next/next/no-img-element -- user-selected catch photos may be data URLs and cannot use the image optimizer. */
import { useEffect, useRef, useState } from 'react'

interface IDResult {
  species: string
  scientific_name: string
  confidence: number
  size_estimate: string
  weight_estimate: string
  best_baits: string[]
  fun_fact: string
  legal_notes: string
  is_fish: boolean
}

export default function FishIdentifier() {
  const [result, setResult] = useState<IDResult | null>(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'requesting' | 'ready' | 'denied'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOpen(false)
    setCameraStatus('idle')
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const openCamera = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not available in this browser. Use the upload option instead.')
      return
    }
    setCameraStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      setCameraOpen(true)
      setCameraStatus('ready')
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
    } catch {
      setCameraStatus('denied')
      setError('Camera permission was denied or unavailable. You can still upload a catch photo.')
    }
  }

  const identify = async (b64: string) => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/ai/identify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_base64: b64 }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.error) { setError(data.error); return }
      if (!data.is_fish) { setError('No fish detected. Try a clearer image with the whole catch visible.'); return }
      setResult(data as IDResult)
    } catch { setError('Identification failed. No result was generated.') }
    finally { setLoading(false) }
  }

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Choose a JPEG, PNG, or WebP image.'); return }
    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      const dataUrl = typeof loadEvent.target?.result === 'string' ? loadEvent.target.result : ''
      if (dataUrl) { setPreview(dataUrl); void identify(dataUrl) }
    }
    reader.readAsDataURL(file)
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera is still starting. Hold the catch in frame and try again.')
      return
    }
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1280 / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) { setError('Could not capture the camera frame.'); return }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
    setPreview(dataUrl)
    stopCamera()
    void identify(dataUrl)
  }

  const reset = () => {
    stopCamera()
    setPreview('')
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div style={{ fontFamily: 'system-ui,sans-serif', color: 'white' }}>
      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px' }}>AI FISH IDENTIFIER</div>
      <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.45, margin: '0 0 10px' }}>Allow camera access to scan a catch, or upload a photo. The image is sent to the AI identification route only after you capture or choose it.</p>
      {!preview && !cameraOpen && (
        <div style={{ display: 'grid', gap: 8 }}>
          <button type="button" onClick={() => void openCamera()} disabled={cameraStatus === 'requesting'} style={{ width: '100%', background: 'linear-gradient(135deg,#0369a1,#7c3aed)', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            {cameraStatus === 'requesting' ? 'Requesting camera permission…' : 'Open Camera to Scan Catch'}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} style={{ width: '100%', background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', padding: '10px', borderRadius: '9px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Upload Catch Photo</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
      {cameraOpen && (
        <div style={{ marginBottom: 8 }}>
          <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview of catch" style={{ width: '100%', borderRadius: 8, maxHeight: 260, objectFit: 'cover', background: '#020617' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={capturePhoto} style={{ flex: 1, background: '#0891b2', color: 'white', border: 0, padding: 10, borderRadius: 8, fontWeight: 700 }}>Capture and identify</button>
            <button type="button" onClick={stopCamera} style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', padding: '10px 12px', borderRadius: 8 }}>Cancel</button>
          </div>
        </div>
      )}
      {preview && (
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <img src={preview} alt="Catch photo for species identification" style={{ width: '100%', borderRadius: 8, maxHeight: 220, objectFit: 'cover' }} />
          {loading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#7dd3fc', fontSize: 12 }}>AI identifying species…</span></div>}
        </div>
      )}
      {error && <p role="alert" style={{ color: '#f87171', fontSize: 11, textAlign: 'center' }}>{error}</p>}
      {result && (
        <div style={{ background: '#0f172a', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: '#22d3ee' }}>{result.species}</div>
          <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', marginBottom: 6 }}>{result.scientific_name} · {Math.round(result.confidence * 100)}% model confidence</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
            {result.size_estimate && <div style={{ background: '#1e293b', borderRadius: 5, padding: 5 }}><div style={{ fontSize: 8, color: '#64748b' }}>SIZE</div><div style={{ fontSize: 10, color: '#e2e8f0' }}>{result.size_estimate}</div></div>}
            {result.weight_estimate && <div style={{ background: '#1e293b', borderRadius: 5, padding: 5 }}><div style={{ fontSize: 8, color: '#64748b' }}>WEIGHT</div><div style={{ fontSize: 10, color: '#e2e8f0' }}>{result.weight_estimate}</div></div>}
          </div>
          {result.best_baits?.length > 0 && <div style={{ marginBottom: 6 }}><div style={{ fontSize: 8, color: '#64748b', marginBottom: 3 }}>BEST BAITS</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>{result.best_baits.map((bait) => <span key={bait} style={{ background: '#0f3460', color: '#93c5fd', fontSize: 9, padding: '2px 6px', borderRadius: 10 }}>{bait}</span>)}</div></div>}
          {result.fun_fact && <p style={{ fontSize: 10, color: '#7dd3fc', borderLeft: '3px solid #0ea5e9', paddingLeft: 6, margin: '0 0 6px' }}>{result.fun_fact}</p>}
          {result.legal_notes && <p style={{ fontSize: 9, color: '#64748b', margin: 0 }}>{result.legal_notes}</p>}
          <button type="button" onClick={reset} style={{ width: '100%', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: 5, borderRadius: 5, fontSize: 10, cursor: 'pointer', marginTop: 8 }}>Identify Another Fish</button>
        </div>
      )}
    </div>
  )
}
