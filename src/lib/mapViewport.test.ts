import { describe, expect, it } from 'vitest';
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_OVERLAY_INSETS,
  MAP_Z_INDEX,
  OKLAHOMA_MAP_VIEW,
  POPUP_MAX_HEIGHT,
  POPUP_MIN_HEIGHT,
  SPOT_FOCUS_ZOOM,
  VIEW_MATCH_EPSILON,
  resolveMapInsets,
  resolveSpotFocusLayout,
  resolveSpotPopupFrame,
  resolveVisibleArea,
  resolveZoomControlButtons,
  resolveZoomControlState,
} from './mapViewport';

describe('map view constants', () => {
  it('offers a zoom range that can zoom out past the Oklahoma overview and back in', () => {
    expect(MAP_MIN_ZOOM).toBeLessThan(OKLAHOMA_MAP_VIEW.zoom);
    expect(OKLAHOMA_MAP_VIEW.zoom).toBeLessThan(SPOT_FOCUS_ZOOM);
    expect(SPOT_FOCUS_ZOOM).toBeLessThanOrEqual(MAP_MAX_ZOOM);
    expect(OKLAHOMA_MAP_VIEW.center).toEqual({ lat: 35.5, lng: -97.5 });
  });

  it('keeps the interactive controls above every floating overlay', () => {
    expect(MAP_Z_INDEX.controls).toBeGreaterThan(MAP_Z_INDEX.chrome);
    expect(MAP_Z_INDEX.chrome).toBeGreaterThan(MAP_Z_INDEX.leafletControls);
    expect(MAP_Z_INDEX.leafletControls).toBeGreaterThan(MAP_Z_INDEX.vignette);
    expect(MAP_Z_INDEX.effect).toBeLessThan(MAP_Z_INDEX.vignette);
  });
});

describe('resolveMapInsets', () => {
  it('reserves the floating badge strip at the top and the sheet handle at the bottom', () => {
    const insets = resolveMapInsets({ height: 600 });

    expect(insets.top).toBe(MAP_OVERLAY_INSETS.top);
    expect(insets.bottom).toBe(MAP_OVERLAY_INSETS.bottom);
    expect(insets.left).toBe(MAP_OVERLAY_INSETS.side);
    expect(insets.right).toBe(MAP_OVERLAY_INSETS.side);
  });

  it('reserves the open slide-up sheet so a focused spot stays visible above it', () => {
    const closed = resolveMapInsets({ height: 600 });
    const open = resolveMapInsets({ height: 600, sheetOpen: true });

    expect(open.bottom).toBeGreaterThan(closed.bottom);
    expect(open.bottom).toBe(Math.round(600 * 0.45) + MAP_OVERLAY_INSETS.side);
  });
});

describe('resolveVisibleArea', () => {
  it('reports the chrome-free rectangle and its centre on a phone sized map', () => {
    const insets = resolveMapInsets({ height: 600 });
    const area = resolveVisibleArea({ width: 390, height: 600, insets });

    expect(area.top).toBe(insets.top);
    expect(area.bottom).toBe(600 - insets.bottom);
    expect(area.width).toBe(390 - insets.left - insets.right);
    expect(area.height).toBe(area.bottom - area.top);
    expect(area.centerX).toBe(195);
    expect(area.centerY).toBe(area.top + area.height / 2);
    expect(area.sideChrome).toBe(MAP_OVERLAY_INSETS.side);
  });

  it('ignores negative insets and clips insets larger than the map', () => {
    const area = resolveVisibleArea({
      width: 400,
      height: 300,
      insets: { top: -50, bottom: 500, left: -10, right: 0 },
    });

    expect(area.top).toBe(0);
    expect(area.bottom).toBe(0);
    expect(area.height).toBe(1);
    expect(area.width).toBe(400);
    expect(area.sideChrome).toBe(0);
  });
});

describe('resolveSpotPopupFrame', () => {
  it('keeps the popup inside the visible width and height of a phone sized map', () => {
    const insets = resolveMapInsets({ height: 600 });
    const frame = resolveSpotPopupFrame({ width: 390, height: 600, insets });

    expect(frame.maxWidth).toBeLessThanOrEqual(390 - insets.left - insets.right);
    expect(frame.maxWidth).toBeGreaterThanOrEqual(frame.minWidth);
    expect(frame.maxHeight).toBeLessThanOrEqual(600 - insets.top - insets.bottom);
    expect(frame.maxHeight).toBeGreaterThanOrEqual(POPUP_MIN_HEIGHT);
  });

  it('never grows the popup past its maximum size on a large display', () => {
    const insets = resolveMapInsets({ height: 900 });
    const frame = resolveSpotPopupFrame({ width: 1440, height: 900, insets });

    expect(frame.maxHeight).toBe(POPUP_MAX_HEIGHT);
    expect(frame.maxWidth).toBe(360);
  });
});

describe('resolveSpotFocusLayout', () => {
  const insets = resolveMapInsets({ height: 600 });

  it('centres the picked spot horizontally', () => {
    const layout = resolveSpotFocusLayout({ width: 390, height: 600, insets, currentZoom: 7 });

    expect(layout.markerPoint.x).toBe(195);
    expect(layout.centerOffset.x).toBe(0);
  });

  it('keeps marker plus offset on the container centre for every viewport it is given', () => {
    const viewports = [
      { width: 390, height: 600 },
      { width: 320, height: 300 },
      { width: 1440, height: 900 },
      { width: 1, height: 1 },
    ];

    for (const viewport of viewports) {
      for (const sheetOpen of [false, true]) {
        const layout = resolveSpotFocusLayout({
          ...viewport,
          insets: resolveMapInsets({ height: viewport.height, sheetOpen }),
          currentZoom: 9,
        });

        // The projected spot plus the offset has to land on the container centre exactly,
        // otherwise every pick would drift by the rounding remainder.
        expect(layout.markerPoint.x + layout.centerOffset.x).toBe(Math.round(viewport.width / 2));
        expect(layout.markerPoint.y + layout.centerOffset.y).toBe(Math.round(viewport.height / 2));
      }
    }
  });

  it('uses the visible centre, not the container centre, when one side is cluttered', () => {
    const lopsided = { top: insets.top, bottom: insets.bottom, left: 16, right: 200 };
    const layout = resolveSpotFocusLayout({
      width: 390,
      height: 600,
      insets: lopsided,
      currentZoom: 9,
    });

    // A 200px right-hand panel leaves the usable centre well left of 195px:
    // 16px gutter + (390 - 16 - 200) / 2.
    expect(layout.markerPoint.x).toBe(Math.round(16 + (390 - 16 - 200) / 2));
    expect(layout.markerPoint.x).toBeLessThan(195);
  });

  it('drops the marker below the popup so the whole panel stays on screen', () => {
    const layout = resolveSpotFocusLayout({ width: 390, height: 600, insets, currentZoom: 7 });
    const popupTop = layout.markerPoint.y - layout.popup.maxHeight;

    expect(popupTop).toBeGreaterThanOrEqual(insets.top);
    expect(layout.markerPoint.y).toBeLessThanOrEqual(600 - insets.bottom);
    expect(layout.centerOffset.y).toBe(300 - layout.markerPoint.y);
  });

  it('zooms in on the spot without fighting a closer existing zoom level', () => {
    const zoomedOut = resolveSpotFocusLayout({ width: 390, height: 600, insets, currentZoom: 6 });
    const alreadyClose = resolveSpotFocusLayout({ width: 390, height: 600, insets, currentZoom: 15 });

    expect(zoomedOut.zoom).toBe(SPOT_FOCUS_ZOOM);
    expect(alreadyClose.zoom).toBe(15);
  });

  it('never asks for a zoom outside the map limits', () => {
    const layout = resolveSpotFocusLayout({
      width: 390,
      height: 600,
      insets,
      currentZoom: 18,
      minZoom: 5,
      maxZoom: 16,
    });

    expect(layout.zoom).toBe(16);
  });

  it('keeps the marker inside a short viewport instead of pushing it under the sheet', () => {
    const shortInsets = resolveMapInsets({ height: 300, sheetOpen: true });
    const layout = resolveSpotFocusLayout({
      width: 320,
      height: 300,
      insets: shortInsets,
      currentZoom: 7,
    });

    // The sheet leaves only ~57px of map here, which cannot fit the minimum popup, so the
    // marker is pinned to the bottom of the usable strip rather than placed below the sheet.
    expect(layout.markerPoint.x).toBe(160);
    expect(layout.markerPoint.y).toBeGreaterThan(0);
    expect(layout.markerPoint.y).toBeLessThanOrEqual(300 - shortInsets.bottom);
    expect(layout.markerPoint.y).toBeGreaterThanOrEqual(shortInsets.top);
    expect(layout.centerOffset.y).toBe(150 - layout.markerPoint.y);
    expect(layout.popup.maxHeight).toBeGreaterThanOrEqual(POPUP_MIN_HEIGHT);
  });
});

describe('resolveZoomControlState', () => {
  it('disables zooming out at the minimum zoom and zooming in at the maximum', () => {
    expect(resolveZoomControlState({ zoom: MAP_MIN_ZOOM }).canZoomOut).toBe(false);
    expect(resolveZoomControlState({ zoom: MAP_MIN_ZOOM }).canZoomIn).toBe(true);
    expect(resolveZoomControlState({ zoom: MAP_MAX_ZOOM }).canZoomIn).toBe(false);
    expect(resolveZoomControlState({ zoom: MAP_MAX_ZOOM }).canZoomOut).toBe(true);
  });

  it('offers a view reset whenever the map has left the Oklahoma overview', () => {
    const overview = resolveZoomControlState({
      zoom: OKLAHOMA_MAP_VIEW.zoom,
      center: OKLAHOMA_MAP_VIEW.center,
    });
    const zoomedIn = resolveZoomControlState({
      zoom: SPOT_FOCUS_ZOOM,
      center: OKLAHOMA_MAP_VIEW.center,
    });
    const panned = resolveZoomControlState({
      zoom: OKLAHOMA_MAP_VIEW.zoom,
      center: { lat: 35.5, lng: -96.2 },
    });

    expect(overview.canResetView).toBe(false);
    expect(zoomedIn.canResetView).toBe(true);
    expect(panned.canResetView).toBe(true);
  });

  it('tolerates the fractional zooms Leaflet reports mid animation', () => {
    const jitter = VIEW_MATCH_EPSILON / 2;
    const clearlyMoved = VIEW_MATCH_EPSILON * 4;

    expect(resolveZoomControlState({ zoom: OKLAHOMA_MAP_VIEW.zoom + jitter }).canResetView).toBe(
      false,
    );
    expect(
      resolveZoomControlState({ zoom: OKLAHOMA_MAP_VIEW.zoom + clearlyMoved }).canResetView,
    ).toBe(true);
    expect(
      resolveZoomControlState({
        zoom: OKLAHOMA_MAP_VIEW.zoom,
        center: { lat: OKLAHOMA_MAP_VIEW.center.lat + jitter, lng: OKLAHOMA_MAP_VIEW.center.lng },
      }).canResetView,
    ).toBe(false);
    expect(
      resolveZoomControlState({
        zoom: OKLAHOMA_MAP_VIEW.zoom,
        center: {
          lat: OKLAHOMA_MAP_VIEW.center.lat,
          lng: OKLAHOMA_MAP_VIEW.center.lng + clearlyMoved,
        },
      }).canResetView,
    ).toBe(true);
  });

  it('disables a limit button just short of the limit, not after it', () => {
    const nudge = VIEW_MATCH_EPSILON / 2;

    expect(resolveZoomControlState({ zoom: MAP_MAX_ZOOM - nudge }).canZoomIn).toBe(false);
    expect(resolveZoomControlState({ zoom: MAP_MAX_ZOOM - 1 }).canZoomIn).toBe(true);
    expect(resolveZoomControlState({ zoom: MAP_MIN_ZOOM + nudge }).canZoomOut).toBe(false);
    expect(resolveZoomControlState({ zoom: MAP_MIN_ZOOM + 1 }).canZoomOut).toBe(true);
  });
});

describe('resolveZoomControlButtons', () => {
  const labels = resolveZoomControlButtons({
    canZoomIn: true,
    canZoomOut: true,
    canResetView: true,
  });

  it('orders the stack zoom in, zoom out, reset with one glyph and label each', () => {
    expect(labels.map((button) => button.id)).toEqual(['in', 'out', 'reset']);
    expect(labels.map((button) => button.glyph)).toEqual(['+', '−', '⟲']);
    expect(labels.every((button) => button.enabled)).toBe(true);
    expect(new Set(labels.map((button) => button.label)).size).toBe(labels.length);
  });

  it('maps each actionable flag onto exactly one button', () => {
    const state = { canZoomIn: false, canZoomOut: true, canResetView: false };
    const buttons = resolveZoomControlButtons(state);

    expect(buttons.map((button) => button.enabled)).toEqual([false, true, false]);
    expect(buttons.map((button) => button.label)).toEqual([
      'Zoom in',
      'Zoom out',
      'Reset map view',
    ]);
  });
});