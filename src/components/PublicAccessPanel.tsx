'use client';

import type { PublicFishingAccessPoint } from '@/lib/publicAccess';

const badgeStyle = {
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 700,
  padding: '4px 8px',
} as const;

function statusLabel(status: 'confirmed' | 'not_available' | 'unknown') {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'not_available') return 'Not available';
  return 'Not verified';
}

export default function PublicAccessPanel({
  access,
}: {
  access: PublicFishingAccessPoint;
}) {
  const verified = access.verificationStatus === 'official';

  return (
    <section
      style={{
        background: '#0a0f1e',
        border: '1px solid #1e293b',
        borderRadius: 14,
        color: '#e2e8f0',
        padding: 14,
      }}
    >
      <div style={{ alignItems: 'flex-start', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#22d3ee', fontSize: 14, fontWeight: 800 }}>
            Public Access
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}>
            {access.accessType.replace('_', ' ')} · {access.city}, OK
          </div>
        </div>

        <span
          style={{
            ...badgeStyle,
            background: verified ? '#083344' : '#3f3f46',
            color: verified ? '#67e8f9' : '#d4d4d8',
          }}
        >
          {verified ? 'Official source' : 'Needs verification'}
        </span>
      </div>

      {access.accessNotes ? (
        <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.45, margin: '12px 0' }}>
          {access.accessNotes}
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <span style={{ ...badgeStyle, background: '#064e3b', color: '#6ee7b7' }}>
          🎣 Public fishing
        </span>

        {access.adaFishing === 'confirmed' ? (
          <span style={{ ...badgeStyle, background: '#14532d', color: '#bbf7d0' }}>
            ♿ ADA fishing access
          </span>
        ) : null}

        {access.adaParking === 'confirmed' ? (
          <span style={{ ...badgeStyle, background: '#14532d', color: '#bbf7d0' }}>
            ♿ ADA parking
          </span>
        ) : null}

        {access.parking.available === true ? (
          <span style={{ ...badgeStyle, background: '#172554', color: '#bfdbfe' }}>
            🅿 Parking
          </span>
        ) : null}

        {access.permit.required ? (
          <span style={{ ...badgeStyle, background: '#78350f', color: '#fde68a' }}>
            ⚠ Permit/license
          </span>
        ) : null}
      </div>

      <div style={{ borderTop: '1px solid #1e293b', marginTop: 14, paddingTop: 12 }}>
        <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
          Accessibility & parking
        </div>
        <p style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.5, margin: '7px 0 0' }}>
          ADA fishing: {statusLabel(access.adaFishing)} · ADA parking:{' '}
          {statusLabel(access.adaParking)} · Parking:{' '}
          {access.parking.available === true ? 'Available' : 'Verify before travel'}
        </p>
        {access.parking.notes ? (
          <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45, margin: '7px 0 0' }}>
            {access.parking.notes}
          </p>
        ) : null}
      </div>

      <div style={{ borderTop: '1px solid #1e293b', marginTop: 14, paddingTop: 12 }}>
        <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
          Permit requirements
        </div>
        <p style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.5, margin: '7px 0 0' }}>
          {access.permit.summary}
        </p>
        {access.permit.officialUrl ? (
          <a
            href={access.permit.officialUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#38bdf8', display: 'inline-block', fontSize: 12, marginTop: 8 }}
          >
            View official rules ↗
          </a>
        ) : null}
      </div>

      <div style={{ color: '#64748b', fontSize: 10, marginTop: 14 }}>
        Source: {access.sourceName} · Verified {access.verifiedAt}
      </div>
    </section>
  );
}
