'use client';

import { useEffect, useState } from 'react';
import { fetchSeamcastAiSpots } from '@/lib/seamcastSpotsClient';

type SpotsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: unknown }
  | { status: 'error'; message: string };

export default function AiSpotsDemo() {
  const [state, setState] = useState<SpotsState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: 'loading' });
      try {
        const data = await fetchSeamcastAiSpots(34.999, -97.366);
        if (!cancelled) {
          setState({ status: 'ok', data });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Unknown error loading AI spots';
          setState({
            status: 'error',
            message,
          });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        padding: '1rem',
        borderRadius: '0.5rem',
        border: '1px solid #4b5563',
        backgroundColor: '#020617',
        color: '#e5e7eb',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont',
      }}
    >
      <h2
        style={{
          fontSize: '1.1rem',
          marginBottom: '0.5rem',
        }}
      >
        Seamcast AI Spots (Purcell)
      </h2>

      {state.status === 'idle' && <p>Idle…</p>}
      {state.status === 'loading' && <p>Loading AI spots…</p>}
      {state.status === 'error' && (
        <p style={{ color: '#f97316' }}>
          Error: {state.message}
        </p>
      )}
      {state.status === 'ok' && (
        <pre
          style={{
            marginTop: '0.75rem',
            backgroundColor: '#0b1120',
            padding: '0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
            overflowX: 'auto',
            maxHeight: '16rem',
          }}
        >
          {JSON.stringify(state.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
