import { describe, expect, it } from 'vitest';
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_OVERLAY_INSETS,
  OKLAHOMA_MAP_VIEW,
  POPUP_MAX_HEIGHT,
  POPUP_MIN_HEIGHT,
  SPOT_FOCUS_ZOOM,
  resolveMapInsets,
  resolveSpotFocusLayout,
  resolveSpotPopupFrame,
  resolveZoomControlState,
} from './mapViewport';

describe('map view constants', () => {
  it('offers a zoom range that can zoom out past the Oklahoma overview and back in', () => {
    expect(MAP_MIN_ZOOM).toBeLessThan(OKLAHOMA_MAP_VIEW.zoom);
    expect(OKLAHOMA_MAP_VIEW.zoom).toBeLessThan(SPOT_FOCUS_ZOOM);
    expect(SPOT_FOCUS_ZOOM).toBeLessThanOrEqual(MAP_MAX_ZOOM);
    expect(OKLAHOMA_MAP_VIEW.center).toEqual({ lat: 35.5, lng: -97.5 });
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

  it('stays inside a very short viewport instead of producing negative offsets', () => {
    const shortInsets = resolveMapInsets({ height: 300, sheetOpen: true });
    const layout = resolveSpotFocusLayout({
      width: 320,
      height: 300,
      insets: shortInsets,
      currentZoom: 7,
    });

    // The sheet leaves only ~57px of map here, which cannot fit the minimum popup, so the
    // marker is centred rather than pushed outside the viewport.
    expect(layout.markerPoint.x).toBe(160);
    expect(layout.markerPoint.y).toBeGreaterThan(0);
    expect(layout.markerPoint.y).toBeLessThan(300);
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
});