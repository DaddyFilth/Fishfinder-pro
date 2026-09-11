'use client';

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#030712',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '420px',
          textAlign: 'center',
          background: '#0a0f1e',
          border: '1px solid #1e293b',
          borderRadius: '18px',
          padding: '30px 22px',
        }}
      >
        <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎣</div>

        <h1
          style={{
            margin: 0,
            color: '#22d3ee',
            fontSize: '22px',
          }}
        >
          Fishfinder Pro is offline
        </h1>

        <p
          style={{
            color: '#94a3b8',
            fontSize: '14px',
            lineHeight: 1.55,
            margin: '14px 0 22px',
          }}
        >
          Your saved Logbook trips, catch photos, Gallery, saved location, and
          previously loaded app content remain available on this device.
        </p>

        <div
          style={{
            textAlign: 'left',
            background: '#0f172a',
            borderRadius: '10px',
            padding: '14px',
            color: '#cbd5e1',
            fontSize: '12px',
            lineHeight: 1.6,
          }}
        >
          <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: '5px' }}>
            Live features need a connection
          </div>
          <div>• Current weather and conditions</div>
          <div>• Fresh bite-time calculations</div>
          <div>• New AI spot recommendations</div>
          <div>• New fish identification requests</div>
        </div>

        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '22px',
            width: '100%',
            border: 0,
            borderRadius: '10px',
            padding: '12px',
            background: 'linear-gradient(135deg, #0369a1, #7c3aed)',
            color: 'white',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Try reconnecting
        </button>
      </section>
    </main>
  );
}
