'use client';

import { useEffect, useState } from 'react';

type PinType = 'structure' | 'hazard' | 'ramp' | 'shore_access' | 'tip';

type CommunityPin = {
  id: string;
  known_spot_id: string;
  pin_type: PinType;
  title: string;
  description: string;
  lat: number;
  lng: number;
  source_url: string | null;
  expires_at: string | null;
  created_at: string;
};

const PIN_TYPES: Array<{ value: PinType; label: string; icon: string; color: string }> = [
  { value: 'structure', label: 'Structure', icon: '🪵', color: '#f59e0b' },
  { value: 'hazard', label: 'Hazard', icon: '⚠️', color: '#ef4444' },
  { value: 'ramp', label: 'Boat ramp', icon: '🛶', color: '#38bdf8' },
  { value: 'shore_access', label: 'Shore access', icon: '🏖️', color: '#22d3ee' },
  { value: 'tip', label: 'Local tip', icon: '💡', color: '#a78bfa' },
];

const inputStyle = {
  background: '#111827',
  border: '1px solid #334155',
  borderRadius: 8,
  boxSizing: 'border-box' as const,
  color: '#f8fafc',
  fontSize: 12,
  padding: '9px 10px',
  width: '100%',
};

function pinMeta(pinType: PinType) {
  return PIN_TYPES.find((type) => type.value === pinType) ?? PIN_TYPES[0];
}

function toLocalDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function CommunityPinsPanel({
  knownSpotId,
  spotName,
  latitude,
  longitude,
}: {
  knownSpotId: string;
  spotName: string;
  latitude: number;
  longitude: number;
}) {
  const [pins, setPins] = useState<CommunityPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pinType, setPinType] = useState<PinType>('tip');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadPins() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          `/api/community-pins?knownSpotId=${encodeURIComponent(knownSpotId)}`,
          { cache: 'no-store' },
        );

        if (response.status === 401) {
          if (active) {
            setPins([]);
            setError('Sign in to view and add community reports.');
          }
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Unable to load community reports.');
        }

        if (active) setPins(Array.isArray(data) ? data : []);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Unable to load community reports.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPins();

    return () => {
      active = false;
    };
  }, [knownSpotId]);

  const resetForm = () => {
    setPinType('tip');
    setTitle('');
    setDescription('');
    setSourceUrl('');
    setExpiresAt('');
    setError('');
  };

  const publish = async () => {
    setError('');
    setMessage('');

    if (title.trim().length < 3) {
      setError('Add a report title with at least 3 characters.');
      return;
    }

    if (pinType === 'hazard' && !expiresAt) {
      setError('Hazard reports require an expiration date and time.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/community-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knownSpotId,
          pinType,
          title: title.trim(),
          description: description.trim(),
          lat: latitude,
          lng: longitude,
          sourceUrl: sourceUrl.trim() || null,
          expiresAt: pinType === 'hazard' ? new Date(expiresAt).toISOString() : null,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        setError('Sign in to publish a community report.');
        return;
      }

      if (!response.ok) {
        const serverError =
          typeof data.error === 'string'
            ? data.error
            : 'Your report could not be published.';
        throw new Error(serverError);
      }

      if (data.pin) {
        setPins((previous) => [data.pin as CommunityPin, ...previous]);
      }

      setMessage(
        typeof data.message === 'string'
          ? data.message
          : 'Community report published.',
      );
      resetForm();
      setShowForm(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your report could not be published.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section style={{ marginTop: 8 }}>
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 800 }}>
            Community reports
          </div>
          <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
            Reports tied to {spotName}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setMessage('');
            setError('');
            setShowForm((open) => !open);
          }}
          style={{
            background: '#0f766e',
            border: '1px solid #14b8a6',
            borderRadius: 8,
            color: 'white',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 800,
            minHeight: 36,
            padding: '7px 10px',
          }}
        >
          {showForm ? 'Cancel' : '+ Add report'}
        </button>
      </div>

      <div
        style={{
          background: 'rgba(15,23,42,0.72)',
          border: '1px solid rgba(148,163,184,0.18)',
          borderRadius: 9,
          color: '#94a3b8',
          fontSize: 10,
          lineHeight: 1.45,
          marginBottom: 9,
          padding: '8px 9px',
        }}
      >
        Community-reported information may be incomplete or outdated. Confirm access,
        parking, permits, hazards, and conditions before traveling.
      </div>

      {showForm && (
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 10,
            marginBottom: 10,
            padding: 10,
          }}
        >
          <label style={{ color: '#cbd5e1', display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 5 }}>
            Report type
          </label>
          <select
            value={pinType}
            onChange={(event) => setPinType(event.target.value as PinType)}
            style={inputStyle}
          >
            {PIN_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>

          <label style={{ color: '#cbd5e1', display: 'block', fontSize: 11, fontWeight: 700, margin: '10px 0 5px' }}>
            Title
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Example: East ramp closed after rain"
            style={inputStyle}
          />

          <label style={{ color: '#cbd5e1', display: 'block', fontSize: 11, fontWeight: 700, margin: '10px 0 5px' }}>
            Details <span style={{ color: '#64748b', fontWeight: 500 }}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
            placeholder="Helpful, public-safe details for other anglers."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />

          <label style={{ color: '#cbd5e1', display: 'block', fontSize: 11, fontWeight: 700, margin: '10px 0 5px' }}>
            Source link <span style={{ color: '#64748b', fontWeight: 500 }}>(optional)</span>
          </label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            maxLength={2000}
            placeholder="https://..."
            style={inputStyle}
          />

          {pinType === 'hazard' && (
            <>
              <label style={{ color: '#fecaca', display: 'block', fontSize: 11, fontWeight: 700, margin: '10px 0 5px' }}>
                Hazard expiry
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                min={toLocalDateTimeValue(new Date())}
                max={toLocalDateTimeValue(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))}
                onChange={(event) => setExpiresAt(event.target.value)}
                style={inputStyle}
              />
            </>
          )}

          <div style={{ color: '#94a3b8', fontSize: 10, lineHeight: 1.4, marginTop: 10 }}>
            This publishes a community-reported pin at this official access location.
            Do not submit private fishing locations or personal information.
          </div>

          {error && (
            <div style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: 8, color: '#fecaca', fontSize: 11, marginTop: 10, padding: 8 }}>
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={publish}
            style={{
              background: submitting ? '#334155' : '#0f766e',
              border: '1px solid #14b8a6',
              borderRadius: 8,
              color: 'white',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 800,
              marginTop: 10,
              minHeight: 42,
              opacity: submitting ? 0.75 : 1,
              padding: '9px 12px',
              width: '100%',
            }}
          >
            {submitting ? 'Publishing…' : 'Publish community report'}
          </button>
        </div>
      )}

      {message && (
        <div style={{ background: '#052e16', border: '1px solid #166534', borderRadius: 8, color: '#bbf7d0', fontSize: 11, marginBottom: 10, padding: 8 }}>
          {message}
        </div>
      )}

      {loading && (
        <div style={{ color: '#94a3b8', fontSize: 11, padding: '8px 0' }}>
          Loading community reports…
        </div>
      )}

      {!loading && !error && pins.length === 0 && (
        <div style={{ color: '#94a3b8', fontSize: 11, padding: '8px 0' }}>
          No community reports yet. Add a public-safe update for other anglers.
        </div>
      )}

      {!loading && pins.map((pin) => {
        const meta = pinMeta(pin.pin_type);

        return (
          <article
            key={pin.id}
            style={{
              background: '#111827',
              border: `1px solid ${meta.color}55`,
              borderRadius: 9,
              marginBottom: 8,
              padding: 10,
            }}
          >
            <div style={{ alignItems: 'flex-start', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: meta.color, fontSize: 10, fontWeight: 800, marginBottom: 3 }}>
                  {meta.icon} {meta.label.toUpperCase()} · COMMUNITY REPORTED
                </div>
                <div style={{ color: '#f8fafc', fontSize: 12, fontWeight: 800 }}>
                  {pin.title}
                </div>
              </div>
              <div style={{ color: '#64748b', fontSize: 10, whiteSpace: 'nowrap' }}>
                {new Date(pin.created_at).toLocaleDateString()}
              </div>
            </div>

            {pin.description && (
              <p style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.45, margin: '7px 0 0' }}>
                {pin.description}
              </p>
            )}

            {pin.pin_type === 'hazard' && pin.expires_at && (
              <div style={{ color: '#fecaca', fontSize: 10, marginTop: 7 }}>
                Hazard expiry: {new Date(pin.expires_at).toLocaleString()}
              </div>
            )}

            {pin.source_url && (
              <a
                href={pin.source_url}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#67e8f9', display: 'inline-block', fontSize: 10, marginTop: 7 }}
              >
                View source ↗
              </a>
            )}
          </article>
        );
      })}
    </section>
  );
}
