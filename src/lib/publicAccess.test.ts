import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PUBLIC_ACCESS_FILTERS,
  filterPublicAccessPoints,
  type PublicFishingAccessPoint,
  validatePublicAccessData,
} from './publicAccess';

const createPoint = (
  overrides: Partial<PublicFishingAccessPoint> = {},
): PublicFishingAccessPoint => ({
  id: 'point-1',
  spotName: 'Point One',
  waterBody: 'Lake One',
  city: 'Purcell',
  state: 'OK',
  latitude: 35,
  longitude: -97,
  publicAccess: true,
  accessType: 'shoreline',
  adaFishing: 'unknown',
  adaParking: 'unknown',
  pavedRouteToWater: 'unknown',
  accessibleRestroom: 'unknown',
  parking: {
    available: true,
    adaStatus: 'unknown',
  },
  permit: {
    required: true,
    summary: 'State license required',
  },
  sourceName: 'ODWC',
  sourceUrl: 'https://example.com/source',
  verifiedAt: '2026-09-08',
  verificationStatus: 'official',
  ...overrides,
});

describe('public access helpers', () => {
  it('filters points with enabled public-access filters', () => {
    const matchingPoint = createPoint({
      id: 'match',
      adaFishing: 'confirmed',
      accessType: 'shoreline',
    });
    const nonMatchingPoint = createPoint({
      id: 'no-match',
      publicAccess: false,
      permit: { required: false, summary: 'No permit' },
    });

    const filtered = filterPublicAccessPoints(
      [matchingPoint, nonMatchingPoint],
      {
        ...DEFAULT_PUBLIC_ACCESS_FILTERS,
        publicFishing: true,
        adaFishing: true,
        shoreline: true,
        permitRequired: true,
      },
    );

    expect(filtered).toEqual([matchingPoint]);
  });

  it('validates required fields and data constraints', () => {
    const invalidPoint = createPoint({
      id: 'duplicate-id',
      spotName: ' ',
      sourceUrl: 'http://example.com/source',
      verifiedAt: '09-08-2026',
      latitude: 40,
      longitude: -110,
      adaFishing: 'confirmed',
      verificationStatus: 'community',
    });

    const errors = validatePublicAccessData([invalidPoint, { ...invalidPoint }]);

    expect(errors).toEqual(
      expect.arrayContaining([
        'Duplicate public access ID: duplicate-id',
        'duplicate-id: missing spotName',
        'duplicate-id: sourceUrl must use https',
        'duplicate-id: verifiedAt must be YYYY-MM-DD',
        'duplicate-id: latitude is outside Oklahoma bounds',
        'duplicate-id: longitude is outside Oklahoma bounds',
        'duplicate-id: confirmed ADA fishing must have an official source',
      ]),
    );
  });
});
