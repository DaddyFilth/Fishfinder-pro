'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

export interface LogbookTrip {
  id: string;
  title: string;
  waterBody: string;
  date: string;
  weather: string;
  species: string;
  catchesCount: number;
  notes: string;
  photos: string[];
  lat: number | null;
  lng: number | null;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'fishfinder.logbook.trips.v1';
const MAX_PHOTOS_PER_TRIP = 4;
const MAX_PHOTO_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

const EMPTY_FORM = {
  title: '',
  waterBody: '',
  date: '',
  weather: '',
  species: '',
  catchesCount: '',
  notes: '',
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
  padding: '9px 10px',
  outline: 'none',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 'bold',
  color: '#64748b',
  marginBottom: '4px',
};

function today(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadTrips(): LogbookTrip[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is LogbookTrip => {
      return (
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as LogbookTrip).id === 'string' &&
        typeof (entry as LogbookTrip).title === 'string'
      );
    });
  } catch {
    return [];
  }
}

async function fileToResizedDataUrl(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Could not decode ${file.name}`));
    el.src = rawDataUrl;
  });

  const longestSide = Math.max(image.width, image.height);
  const scale = Math.min(1, MAX_PHOTO_DIMENSION / longestSide);
  if (scale >= 1 && rawDataUrl.length <= 400_000) return rawDataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawDataUrl;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

export default function LogbookTab() {
  const [trips, setTrips] = useState<LogbookTrip[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, date: today() });
  const [photos, setPhotos] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ok' | 'error'>('idle');
  const [gpsError, setGpsError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [formError, setFormError] = useState('');
  const [storageError, setStorageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTrips(loadTrips());
  }, []);

  const persist = (next: LogbookTrip[]) => {
    setTrips(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError('');
    } catch {
      setStorageError(
        'Browser storage is full — this change may not persist. Remove a trip or some photos and try again.'
      );
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setForm({ ...EMPTY_FORM, date: today() });
    setPhotos([]);
    setCoords(null);
    setGpsStatus('idle');
    setGpsError('');
    setPhotoError('');
    setFormError('');
  };

  const update = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onPhotosPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoError('');
    const room = MAX_PHOTOS_PER_TRIP - photos.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (picked.length === 0) {
      setPhotoError(`A trip can hold up to ${MAX_PHOTOS_PER_TRIP} photos.`);
      return;
    }
    if (picked.length < files.length) {
      setPhotoError(`Only ${picked.length} photo(s) added — ${MAX_PHOTOS_PER_TRIP} max per trip.`);
    }
    try {
      const encoded = await Promise.all(picked.map(fileToResizedDataUrl));
      setPhotos((prev) => [...prev, ...encoded]);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not add that photo.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const captureGps = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsStatus('error');
      setGpsError('Geolocation is not supported by this browser.');
      return;
    }
    setGpsStatus('locating');
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGpsStatus('ok');
      },
      (err) => {
        setGpsStatus('error');
        setGpsError(err.message || 'Location unavailable.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const saveTrip = () => {
    const title = form.title.trim();
    if (!title) {
      setFormError('Give the trip a short title, e.g. "Morning at Lake Texoma".');
      return;
    }
    const existing = editingId ? trips.find((t) => t.id === editingId) : undefined;
    const now = new Date().toISOString();
    const entry: LogbookTrip = {
      id: existing ? existing.id : newId(),
      title,
      waterBody: form.waterBody.trim(),
      date: form.date || today(),
      weather: form.weather.trim(),
      species: form.species.trim(),
      catchesCount: Math.max(0, Math.round(Number(form.catchesCount) || 0)),
      notes: form.notes.trim(),
      photos,
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    const next = existing ? trips.map((t) => (t.id === existing.id ? entry : t)) : [entry, ...trips];
    persist(next);
    resetForm();
  };

  const startEdit = (trip: LogbookTrip) => {
    setEditingId(trip.id);
    setShowForm(true);
    setForm({
      title: trip.title,
      waterBody: trip.waterBody,
      date: trip.date,
      weather: trip.weather,
      species: trip.species,
      catchesCount: String(trip.catchesCount),
      notes: trip.notes,
    });
    setPhotos(trip.photos);
    setCoords(trip.lat !== null && trip.lng !== null ? { lat: trip.lat, lng: trip.lng } : null);
    setGpsStatus(trip.lat !== null && trip.lng !== null ? 'ok' : 'idle');
    setGpsError('');
    setPhotoError('');
    setFormError('');
  };

  const deleteTrip = (id: string) => {
    if (!window.confirm('Delete this trip? This cannot be undone.')) return;
    persist(trips.filter((t) => t.id !== id));
    if (editingId === id) resetForm();
  };

  const totalCatches = trips.reduce((sum, t) => sum + t.catchesCount, 0);
  const sortedTrips = [...trips].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#22d3ee' }}>📓 My Logbook</div>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          style={{ background: showForm ? '#334155' : 'linear-gradient(135deg,#0369a1,#7c3aed)', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '18px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {showForm ? '✕ Cancel' : '+ New Trip'}
        </button>
      </div>

      {storageError && (
        <div style={{ background: '#451a03', border: '1px solid #b45309', color: '#fbbf24', borderRadius: '8px', padding: '8px 10px', fontSize: '11px', marginBottom: '10px' }}>
          {storageError}
        </div>
      )}

      {showForm && (
        <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '10px' }}>
            {editingId ? '✏️ Edit Trip' : '➕ Log a Trip'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Trip title *</label>
              <input style={inputStyle} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder='Morning at Lake Texoma' />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type='date' style={inputStyle} value={form.date} onChange={(e) => update('date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Water body</label>
              <input style={inputStyle} value={form.waterBody} onChange={(e) => update('waterBody', e.target.value)} placeholder='Lake Texoma' />
            </div>
            <div>
              <label style={labelStyle}>Species</label>
              <input style={inputStyle} value={form.species} onChange={(e) => update('species', e.target.value)} placeholder='Largemouth bass, crappie' />
            </div>
            <div>
              <label style={labelStyle}>Catches</label>
              <input type='number' min={0} style={inputStyle} value={form.catchesCount} onChange={(e) => update('catchesCount', e.target.value)} placeholder='0' />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Weather / conditions</label>
              <input style={inputStyle} value={form.weather} onChange={(e) => update('weather', e.target.value)} placeholder='Sunny, 75°F, light south wind' />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder='What worked, what did not, spots to revisit…' />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '10px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>📍 GPS coordinates</label>
              <button onClick={captureGps} disabled={gpsStatus === 'locating'} style={{ background: gpsStatus === 'ok' ? '#14532d' : '#0369a1', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: gpsStatus === 'locating' ? 'wait' : 'pointer' }}>
                {gpsStatus === 'locating' ? 'Locating…' : gpsStatus === 'ok' ? '✓ Captured' : 'Use current location'}
              </button>
            </div>
            {coords && (
              <div style={{ fontSize: '10px', color: '#7dd3fc', marginTop: '6px' }}>
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </div>
            )}
            {gpsStatus === 'error' && (
              <div style={{ fontSize: '10px', color: '#f87171', marginTop: '6px' }}>⚠ {gpsError}</div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '10px', marginBottom: '10px' }}>
            <label style={labelStyle}>📷 Photos ({photos.length}/{MAX_PHOTOS_PER_TRIP})</label>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              multiple
              onChange={(e) => onPhotosPicked(e.target.files)}
              style={{ fontSize: '10px', color: '#94a3b8', width: '100%' }}
            />
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {photos.map((photo, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt={`Trip photo ${i + 1}`} style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #1e293b' }} />
                    <button onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', background: '#7f1d1d', color: 'white', border: 'none', fontSize: '10px', lineHeight: '18px', padding: 0, cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {photoError && <div style={{ fontSize: '10px', color: '#f87171', marginTop: '6px' }}>⚠ {photoError}</div>}
          </div>

          {formError && (
            <div style={{ fontSize: '10px', color: '#f87171', marginBottom: '8px' }}>⚠ {formError}</div>
          )}

          <button onClick={saveTrip} style={{ width: '100%', background: 'linear-gradient(135deg,#0369a1,#7c3aed)', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            {editingId ? '💾 Save Changes' : '🎣 Save Trip'}
          </button>
        </div>
      )}

      {trips.length > 0 && (
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>
          {trips.length} trip{trips.length === 1 ? '' : 's'} · {totalCatches} catch{totalCatches === 1 ? '' : 'es'} logged
        </div>
      )}

      {sortedTrips.map((trip) => (
        <div key={trip.id} style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0' }}>{trip.title}</div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                {trip.date}{trip.waterBody ? ` · ${trip.waterBody}` : ''}
              </div>
            </div>
            {trip.catchesCount > 0 && (
              <div style={{ background: '#14532d', color: '#4ade80', fontSize: '11px', fontWeight: 'bold', padding: '3px 9px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                🎣 {trip.catchesCount}
              </div>
            )}
          </div>

          {trip.species && <div style={{ fontSize: '11px', color: '#7dd3fc', marginTop: '6px' }}>◎ {trip.species}</div>}
          {trip.weather && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>🌤 {trip.weather}</div>}
          {trip.notes && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>{trip.notes}</div>}

          {trip.photos.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              {trip.photos.map((photo, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={photo} alt={`${trip.title} photo ${i + 1}`} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #1e293b' }} />
              ))}
            </div>
          )}

          {trip.lat !== null && trip.lng !== null && (
            <div style={{ fontSize: '10px', color: '#475569', marginTop: '8px' }}>
              📍 {trip.lat.toFixed(5)}, {trip.lng.toFixed(5)}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={() => startEdit(trip)} style={{ flex: 1, background: '#0f172a', border: '1px solid #1e293b', color: '#cbd5e1', padding: '7px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>✏️ Edit</button>
            <button onClick={() => deleteTrip(trip.id)} style={{ flex: 1, background: '#0f172a', border: '1px solid #7f1d1d', color: '#f87171', padding: '7px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>🗑 Delete</button>
          </div>
        </div>
      ))}

      {trips.length === 0 && !showForm && (
        <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎣</div>
          <div style={{ color: '#64748b', fontSize: '13px' }}>No trips logged yet</div>
          <button onClick={() => setShowForm(true)} style={{ marginTop: '12px', background: 'linear-gradient(135deg,#0369a1,#7c3aed)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            + Log a Trip
          </button>
        </div>
      )}
    </div>
  );
}
