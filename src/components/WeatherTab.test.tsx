import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WeatherTab from './WeatherTab';

describe('WeatherTab', () => {
  it('asks for a spot or device location when coordinates are missing', () => {
    const html = renderToStaticMarkup(<WeatherTab />);

    expect(html).toContain('Provider weather is unavailable until a spot or device location is selected.');
  });

  it('shows the loading state until the first forecast arrives', () => {
    const html = renderToStaticMarkup(<WeatherTab lat={35.5} lng={-97.5} />);

    expect(html).toContain('Loading NOAA/NWS forecast…');
  });
});
