import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LocationSearchBar from './LocationSearchBar';
import type { Spot } from '@/lib/mapFilters';

const spots: Spot[] = [
  {
    id: 'thunderbird',
    name: 'Lake Thunderbird',
    lat: 35.2,
    lng: -97.3,
    water_type: 'freshwater',
    spot_type: 'lake',
    region: 'Norman',
  },
];

describe('LocationSearchBar', () => {
  it('renders an idle combobox with the caller placeholder', () => {
    const html = renderToStaticMarkup(
      <LocationSearchBar spots={spots} onSelect={() => {}} placeholder="Search 58 public waters…" />,
    );

    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Search fishing locations by name"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Search 58 public waters…');
    // The result list only exists once the user types.
    expect(html).not.toContain('role="listbox"');
  });
});
