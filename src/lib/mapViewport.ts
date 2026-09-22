/**
 * View configuration and layout maths for the fishing map.
 *
 * The map is mobile-first and the app chrome (header, spot badges, slide-up sheet) floats
 * on top of it, so a selected spot has to be centred inside the pixels that are still
 * visible and its popup has to fit above the marker. Everything in this module is pure so
 * the layout rules can be unit tested without a DOM or a live Leaflet map.
 */

export interface MapLatLng {
  lat: number;
  lng: number;
}

/** Oklahoma overview the map opens on and returns to when the view is reset. */
export const OKLAHOMA_MAP_VIEW: { center: MapLatLng; zoom: number } = {
  center: { lat: 35.5, lng: -97.5 },
  zoom: 7,
};

/** Zoom range the map controls expose: wide enough to zoom out past the state line. */
export const MAP_MIN_ZOOM = 4;
export const MAP_MAX_ZOOM = 19;

/** Zoom level used when focusing a spot so water and shoreline stay readable. */
export const SPOT_FOCUS_ZOOM = 12;

/** Height the floating chrome covers at the top/bottom edge of the map. */
export const MAP_OVERLAY_INSETS = { top: 92, bottom: 68, side: 16 } as const;

export const POPUP_MAX_WIDTH = 360;
export const POPUP_MIN_WIDTH = 240;
export const POPUP_PREFERRED_MIN_WIDTH = 310;
export const POPUP_MAX_HEIGHT = 430;
export const POPUP_MIN_HEIGHT = 200;

/** Vertical distance kept between the popup tip and the marker anchor. */
export const POPUP_ANCHOR_GAP = 28;

export interface ViewportInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SpotPopupFrame {
  maxWidth: number;
  minWidth: number;
  maxHeight: number;
}

export interface SpotFocusLayout {
  /** Leaflet popup options that keep the popup box on screen. */
  popup: SpotPopupFrame;
  /** Where the selected marker should sit, in map-container pixels. */
  markerPoint: { x: number; y: number };
  /** Offset added to the projected spot position to get the new map centre. */
  centerOffset: { x: number; y: number };
  /** Zoom level the map should settle on. */
  zoom: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Visible map area once the floating chrome is accounted for. The slide-up sheet owns the
 * bottom 45% of the map while it is open, matching the sheet's own `45dvh` height.
 */
export function resolveMapInsets({
  height,
  sheetOpen = false,
}: {
  height: number;
  sheetOpen?: boolean;
}): ViewportInsets {
  const safeHeight = Math.max(height, 1);

  return {
    top: MAP_OVERLAY_INSETS.top,
    bottom: sheetOpen
      ? Math.round(safeHeight * 0.45) + MAP_OVERLAY_INSETS.side
      : MAP_OVERLAY_INSETS.bottom,
    left: MAP_OVERLAY_INSETS.side,
    right: MAP_OVERLAY_INSETS.side,
  };
}

/**
 * Popup dimensions that fit the space left between the top and bottom chrome, so a spot's
 * detail panel never runs off the screen and scrolls internally instead.
 */
export function resolveSpotPopupFrame({
  width,
  height,
  insets,
}: {
  width: number;
  height: number;
  insets: ViewportInsets;
}): SpotPopupFrame {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const top = Math.max(insets.top, 0);
  const bottom = Math.max(insets.bottom, 0);
  const side = Math.max(insets.left, insets.right, MAP_OVERLAY_INSETS.side);
  const usableHeight = Math.max(safeHeight - top - bottom, 1);

  const maxWidth = Math.round(clamp(safeWidth - side * 2, POPUP_MIN_WIDTH, POPUP_MAX_WIDTH));

  return {
    maxWidth,
    minWidth: Math.min(POPUP_PREFERRED_MIN_WIDTH, maxWidth),
    maxHeight: Math.round(
      clamp(usableHeight - POPUP_ANCHOR_GAP, POPUP_MIN_HEIGHT, POPUP_MAX_HEIGHT),
    ),
  };
}

/**
 * Works out where the map should settle when a spot is picked: the spot is centred
 * horizontally and pushed into the lower half of the viewport so the popup rendered above
 * its marker still fits between the top badges and the bottom sheet.
 */
export function resolveSpotFocusLayout({
  width,
  height,
  insets,
  currentZoom,
  minZoom = MAP_MIN_ZOOM,
  maxZoom = MAP_MAX_ZOOM,
}: {
  width: number;
  height: number;
  insets: ViewportInsets;
  currentZoom: number;
  minZoom?: number;
  maxZoom?: number;
}): SpotFocusLayout {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const top = Math.max(insets.top, 0);
  const bottom = Math.max(insets.bottom, 0);
  const edge = MAP_OVERLAY_INSETS.side;

  const popup = resolveSpotPopupFrame({ width: safeWidth, height: safeHeight, insets });

  const markerX = safeWidth / 2;
  const markerY = clamp(
    top + popup.maxHeight + POPUP_ANCHOR_GAP,
    Math.max(safeHeight / 2, top + edge),
    Math.max(safeHeight - bottom - edge, safeHeight / 2),
  );

  return {
    popup,
    markerPoint: { x: Math.round(markerX), y: Math.round(markerY) },
    centerOffset: {
      x: Math.round(safeWidth / 2 - markerX),
      y: Math.round(safeHeight / 2 - markerY),
    },
    zoom: clamp(Math.max(currentZoom, SPOT_FOCUS_ZOOM), minZoom, maxZoom),
  };
}

export interface ZoomControlState {
  canZoomIn: boolean;
  canZoomOut: boolean;
  canResetView: boolean;
}

/** Which zoom buttons are actionable for the map's current view. */
export function resolveZoomControlState({
  zoom,
  center,
  minZoom = MAP_MIN_ZOOM,
  maxZoom = MAP_MAX_ZOOM,
}: {
  zoom: number;
  center?: MapLatLng;
  minZoom?: number;
  maxZoom?: number;
}): ZoomControlState {
  const movedFromOverview =
    Math.abs(zoom - OKLAHOMA_MAP_VIEW.zoom) > 0.01 ||
    (center !== undefined &&
      (Math.abs(center.lat - OKLAHOMA_MAP_VIEW.center.lat) > 0.01 ||
        Math.abs(center.lng - OKLAHOMA_MAP_VIEW.center.lng) > 0.01));

  return {
    canZoomIn: zoom < maxZoom - 0.01,
    canZoomOut: zoom > minZoom + 0.01,
    canResetView: movedFromOverview,
  };
}