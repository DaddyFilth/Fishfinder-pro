import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: '#07111b',
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <section
        aria-labelledby="not-found-title"
        style={{
          width: 'min(100%, 520px)',
          padding: '32px',
          border: '1px solid #1d3442',
          borderRadius: '16px',
          background: '#0d1c29',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, color: '#67e8f9', fontSize: '13px', fontWeight: 800, letterSpacing: '0.12em' }}>
          404
        </p>
        <h1 id="not-found-title" style={{ margin: '12px 0 8px', fontSize: '28px' }}>
          Page not found
        </h1>
        <p style={{ margin: '0 auto 24px', maxWidth: '38ch', color: '#a8c0cc', lineHeight: 1.6 }}>
          That fishing spot or page is no longer available. Return to the map to find another destination.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            padding: '0 18px',
            borderRadius: '10px',
            background: '#0891b2',
            color: '#ecfeff',
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          Back to map
        </Link>
      </section>
    </main>
  );
}
