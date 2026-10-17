import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FishBot from './FishBot';
import FishIdentifier from './FishIdentifier';
import SmartAnalyticsPanel from './SmartAnalyticsPanel';

/**
 * UI-level guarantee for the AI surfaces: every panel must render usable markup
 * on its own, before any provider call succeeds. Server rendering exercises the
 * real components without a browser, so a broken AI render path fails CI even
 * when no provider credentials are available.
 */
describe('AI panels render', () => {
  it('renders FishBot with the spot name and tool shortcuts', () => {
    const html = renderToStaticMarkup(
      <FishBot spot={{ name: 'Lake Thunderbird' }} conditions={{ water_temp_c: 18 }} />,
    );

    expect(html).toContain('FishBot');
    expect(html).toContain('Lake Thunderbird');
    expect(html).toContain('Bite window');
    expect(html).toContain('Ask FishBot about bait, depth, or species');
  });

  it('renders the fish identifier camera and upload controls', () => {
    const html = renderToStaticMarkup(<FishIdentifier />);

    expect(html).toContain('AI FISH IDENTIFIER');
    expect(html).toContain('Open Camera to Scan Catch');
    expect(html).toContain('Upload Catch Photo');
  });

  it('renders the smart analysis panel for a selected spot', () => {
    const html = renderToStaticMarkup(
      <SmartAnalyticsPanel
        spot={{ id: 's1', name: 'Lake Thunderbird', lat: 35.2, lng: -97.3, water_type: 'freshwater' }}
        coordinates={null}
      />,
    );

    expect(html).toContain('Smart analysis');
    expect(html).toContain('Lake Thunderbird');
    expect(html).toContain('Run analysis');
  });

  it('renders the smart analysis empty state without a spot or location', () => {
    const html = renderToStaticMarkup(<SmartAnalyticsPanel spot={null} coordinates={null} />);

    expect(html).toContain('Choose a spot or enable location');
  });
});
