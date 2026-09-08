export type VerificationStatus = 'official' | 'community' | 'needs_verification';
export type AccessType =
  | 'shoreline'
  | 'fishing_pier'
  | 'dock'
  | 'boat_ramp'
  | 'parking'
  | 'trailhead';

export type AccessibilityStatus = 'confirmed' | 'not_available' | 'unknown';

export interface PermitRequirement {
  required: boolean;
  kind?:
    | 'state_license'
    | 'city_permit'
    | 'land_access_permit'
    | 'day_use_fee'
    | 'check_in'
    | 'special_regulation';
  summary: string;
  officialUrl?: string;
}

export interface ParkingDetails {
  available: boolean | 'unknown';
  adaStatus: AccessibilityStatus;
  surface?: 'paved' | 'gravel' | 'grass' | 'street' | 'unknown';
  fee?: string;
  notes?: string;
}

export interface PublicFishingAccessPoint {
  id: string;
  spotName: string;
  waterBody: string;
  city: string;
  state: 'OK';
  latitude: number;
  longitude: number;

  publicAccess: boolean;
  accessType: AccessType;
  accessNotes?: string;

  adaFishing: AccessibilityStatus;
  adaParking: AccessibilityStatus;
  pavedRouteToWater: AccessibilityStatus;
  accessibleRestroom: AccessibilityStatus;

  parking: ParkingDetails;
  permit: PermitRequirement;

  operator?: string;
  contact?: string;

  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
  verificationStatus: VerificationStatus;
}

const ODWCFishingAreas =
  'https://www.wildlifedepartment.com/fishing/regs/department-fishing-areas';

export const PUBLIC_FISHING_ACCESS_POINTS: PublicFishingAccessPoint[] = [
  {
    id: 'purcell-lake-public-access',
    spotName: 'Purcell Lake',
    waterBody: 'Purcell City Lake',
    city: 'Purcell',
    state: 'OK',
    latitude: 34.990139,
    longitude: -97.389444,

    publicAccess: true,
    accessType: 'shoreline',
    accessNotes:
      'Public lake location. Verify the nearest open access point, ramp, and parking conditions before travel.',

    adaFishing: 'unknown',
    adaParking: 'unknown',
    pavedRouteToWater: 'unknown',
    accessibleRestroom: 'unknown',

    parking: {
      available: 'unknown',
      adaStatus: 'unknown',
      surface: 'unknown',
      notes: 'Parking details need local verification.',
    },

    permit: {
      required: true,
      kind: 'state_license',
      summary:
        'A valid Oklahoma fishing license is generally required unless an exemption applies. Confirm any city-specific rules before fishing.',
      officialUrl: ODWCFishingAreas,
    },

    operator: 'City of Purcell',
    sourceName: 'Oklahoma Department of Wildlife Conservation',
    sourceUrl:
      'https://www.wildlifedepartment.com/fishing/wheretofish/central/purcell-lake',
    verifiedAt: '2026-09-08',
    verificationStatus: 'official',
  },

  {
    id: 'pauls-valley-city-lake-public-access',
    spotName: 'Pauls Valley City Lake',
    waterBody: 'Pauls Valley City Lake',
    city: 'Pauls Valley',
    state: 'OK',
    latitude: 34.782694,
    longitude: -97.204444,

    publicAccess: true,
    accessType: 'shoreline',
    accessNotes:
      'City lake northeast of Pauls Valley. This record is separate from R.C. Longmire Lake.',

    adaFishing: 'unknown',
    adaParking: 'unknown',
    pavedRouteToWater: 'unknown',
    accessibleRestroom: 'unknown',

    parking: {
      available: 'unknown',
      adaStatus: 'unknown',
      surface: 'unknown',
      notes: 'Confirm the closest public parking and accessible route before traveling.',
    },

    permit: {
      required: true,
      kind: 'state_license',
      summary:
        'A valid Oklahoma fishing license is generally required unless an exemption applies. Confirm City of Pauls Valley requirements before fishing.',
      officialUrl: ODWCFishingAreas,
    },

    operator: 'City of Pauls Valley',
    sourceName: 'Oklahoma Department of Wildlife Conservation',
    sourceUrl:
      'https://www.wildlifedepartment.com/fishing/wheretofish/central/pauls-valley-lake',
    verifiedAt: '2026-09-08',
    verificationStatus: 'official',
  },

  {
    id: 'doc-hollis-ada-parking',
    spotName: 'Doc Hollis Lake',
    waterBody: 'Doc Hollis Lake',
    city: 'Frederick',
    state: 'OK',
    latitude: 34.397,
    longitude: -99.019,

    publicAccess: true,
    accessType: 'parking',
    accessNotes:
      'ODWC documents a fishing dock, entrance road, parking lot, and ADA parking.',

    adaFishing: 'unknown',
    adaParking: 'confirmed',
    pavedRouteToWater: 'unknown',
    accessibleRestroom: 'unknown',

    parking: {
      available: true,
      adaStatus: 'confirmed',
      surface: 'unknown',
      notes:
        'ADA parking is listed by ODWC. Confirm current route and surface conditions before travel.',
    },

    permit: {
      required: true,
      kind: 'state_license',
      summary:
        'A valid Oklahoma fishing license is generally required unless an exemption applies.',
      officialUrl: ODWCFishingAreas,
    },

    operator: 'Oklahoma Department of Wildlife Conservation',
    sourceName: 'ODWC — Doc Hollis Lake',
    sourceUrl:
      'https://www.wildlifedepartment.com/fishing/wheretofish/southwest/doc-hollis',
    verifiedAt: '2026-09-08',
    verificationStatus: 'official',
  },
];

export interface PublicAccessFilters {
  publicFishing: boolean;
  adaFishing: boolean;
  adaParking: boolean;
  boatRamp: boolean;
  shoreline: boolean;
  parking: boolean;
  permitRequired: boolean;
}

export const DEFAULT_PUBLIC_ACCESS_FILTERS: PublicAccessFilters = {
  publicFishing: false,
  adaFishing: false,
  adaParking: false,
  boatRamp: false,
  shoreline: false,
  parking: false,
  permitRequired: false,
};

export function filterPublicAccessPoints(
  points: PublicFishingAccessPoint[],
  filters: PublicAccessFilters,
): PublicFishingAccessPoint[] {
  return points.filter((point) => {
    if (filters.publicFishing && !point.publicAccess) return false;
    if (filters.adaFishing && point.adaFishing !== 'confirmed') return false;
    if (filters.adaParking && point.adaParking !== 'confirmed') return false;
    if (filters.boatRamp && point.accessType !== 'boat_ramp') return false;
    if (filters.shoreline && point.accessType !== 'shoreline') return false;
    if (filters.parking && point.parking.available !== true) return false;
    if (filters.permitRequired && !point.permit.required) return false;
    return true;
  });
}

export function validatePublicAccessData(
  points: PublicFishingAccessPoint[] = PUBLIC_FISHING_ACCESS_POINTS,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const point of points) {
    if (ids.has(point.id)) errors.push(`Duplicate public access ID: ${point.id}`);
    ids.add(point.id);

    if (!point.spotName.trim()) errors.push(`${point.id}: missing spotName`);
    if (!point.sourceUrl.startsWith('https://')) {
      errors.push(`${point.id}: sourceUrl must use https`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(point.verifiedAt)) {
      errors.push(`${point.id}: verifiedAt must be YYYY-MM-DD`);
    }
    if (point.latitude < 33.5 || point.latitude > 37.2) {
      errors.push(`${point.id}: latitude is outside Oklahoma bounds`);
    }
    if (point.longitude < -103.2 || point.longitude > -94.3) {
      errors.push(`${point.id}: longitude is outside Oklahoma bounds`);
    }
    if (point.adaFishing === 'confirmed' && point.verificationStatus !== 'official') {
      errors.push(`${point.id}: confirmed ADA fishing must have an official source`);
    }
    if (point.adaParking === 'confirmed' && point.verificationStatus !== 'official') {
      errors.push(`${point.id}: confirmed ADA parking must have an official source`);
    }
  }

  return errors;
}
