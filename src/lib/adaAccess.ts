import type { SpotAdaInfo } from '@/lib/mapFilters';

const ADA_VERIFY_NOTE = 'Verify current ADA access, accommodations, and closures with the managing agency (ODWC, city, or park) before travel.';

const FEATURES: Array<[RegExp, string]> = [
  [/accessible (fishing )?(pier|dock|jetty|jetties)|fishing (pier|dock)/i, 'Accessible fishing pier/dock'],
  [/accessible (fishing )?pads?/i, 'Accessible fishing pads'],
  [/accessible (shore|bank|trail|path)/i, 'Accessible shoreline/path'],
  [/accessible (restroom|parking)/i, 'Accessible restroom/parking'],
  [/accessible fishing areas?|ada/i, 'Accessible fishing area'],
];

/** Derives labeled ADA info from catalog text; returns undefined when no ADA access is documented. */
export function deriveAdaInfo(text: string | undefined): SpotAdaInfo | undefined {
  const source = text ?? '';
  if (!/\bada\b|accessible/i.test(source)) return undefined;
  const accommodations = FEATURES.filter(([re]) => re.test(source)).map(([, label]) => label);
  return {
    accessible: true,
    label: 'ADA accessible fishing',
    accommodations: accommodations.length ? [...new Set(accommodations)] : ['Accessible fishing area'],
    note: ADA_VERIFY_NOTE,
  };
}

export function formatAdaLabel(ada: SpotAdaInfo | undefined): string {
  return ada?.accessible ? `♿ ${ada.label}: ${ada.accommodations.join(', ')}` : 'ADA access not documented in catalog';
}
