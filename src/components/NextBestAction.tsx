'use client'

type NextBestActionProps = {
  spotCount: number
  selectedSpotName?: string | null
  isOnline: boolean
  hasConditions: boolean
  onOpenAi: () => void
  onOpenLogbook: () => void
  onRefresh: () => void
}

export default function NextBestAction({
  spotCount,
  selectedSpotName,
  isOnline,
  hasConditions,
  onOpenAi,
  onOpenLogbook,
  onRefresh,
}: NextBestActionProps) {
  const action = !isOnline
    ? {
        eyebrow: 'Offline mode',
        title: 'Review your saved trip plan',
        body: 'Fresh provider conditions are unavailable; cached spots and logbook data remain available.',
        label: 'Open logbook',
        run: onOpenLogbook,
      }
    : spotCount === 0
      ? {
          eyebrow: 'Map setup',
          title: 'Load nearby fishing spots',
          body: 'Refresh the map to find Oklahoma waters available for planning.',
          label: 'Refresh spots',
          run: onRefresh,
        }
      : selectedSpotName && !hasConditions
        ? {
            eyebrow: 'Recommended next step',
            title: `Analyze ${selectedSpotName}`,
            body: 'Ask FishBot for a fishing window, target species, and technique.',
            label: 'Ask FishBot',
            run: onOpenAi,
          }
        : {
            eyebrow: 'Plan smarter',
            title: 'Build today’s fishing plan',
            body: 'Use available spot metadata and provider-labeled conditions to choose the next move.',
            label: 'Open FishBot',
            run: onOpenAi,
          }

  return (
    <section
      aria-labelledby="next-best-action-title"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        padding: '14px',
        marginBottom: '12px',
        border: '1px solid #155e75',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #082f49, #0f172a)',
      }}
    >
      <div>
        <div style={{ color: '#67e8f9', fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em' }}>
          {action.eyebrow.toUpperCase()}
        </div>
        <h2 id="next-best-action-title" style={{ color: '#f8fafc', fontSize: '15px', margin: '5px 0' }}>
          {action.title}
        </h2>
        <p style={{ color: '#bae6fd', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>
          {action.body}
        </p>
      </div>
      <button
        type="button"
        onClick={action.run}
        style={{
          flexShrink: 0,
          border: 0,
          borderRadius: '10px',
          padding: '10px 12px',
          color: '#082f49',
          background: '#67e8f9',
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        {action.label}
      </button>
    </section>
  )
}
