import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HotZoneOverlay from './HotZoneOverlay';

const biteRateFor = vi.hoisted(() => vi.fn());

vi.mock('react-leaflet', () => ({
  Circle: ({
    center,
    radius,
  }: {
    center: [number, number];
    radius: number;
  }) => createElement('div', {
    'data-hot-zone-circle': '',
    'data-center': center.join(','),
    'data-radius': radius,
  }),
}));

vi.mock('@/lib/speciesCatalog', () => ({
  SPECIES: [{ id: 'first' }, { id: 'second' }],
  biteRateFor,
}));

describe('HotZoneOverlay', () => {
  beforeEach(() => {
    biteRateFor.mockReset();
  });

  it('renders one 500-meter geographic circle when any species is prime', () => {
    biteRateFor.mockReturnValue(70);

    const markup = renderToStaticMarkup(
      <HotZoneOverlay center={[35, -97]} condition="stable" visible />,
    );

    expect(markup.match(/data-hot-zone-circle/g)).toHaveLength(1);
    expect(markup).toContain('data-radius="500"');
    expect(markup).toContain('data-center="35,-97"');
  });

  it('does not render a circle when hidden, without conditions, or with no prime species', () => {
    biteRateFor.mockReturnValue(70);
    expect(renderToStaticMarkup(
      <HotZoneOverlay center={[35, -97]} condition="stable" visible={false} />,
    )).toBe('');
    expect(renderToStaticMarkup(
      <HotZoneOverlay center={[35, -97]} condition={null} visible />,
    )).toBe('');

    biteRateFor.mockReturnValue(69);
    expect(renderToStaticMarkup(
      <HotZoneOverlay center={[35, -97]} condition="stable" visible />,
    )).toBe('');
  });
});
