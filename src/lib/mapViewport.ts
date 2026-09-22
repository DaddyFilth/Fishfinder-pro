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

/**
 * Stacking order inside the map shell. Shared so a floating card can never bury the
 * interactive controls again (the bug this module's callers already hit once).
 */
export const MAP_Z_INDEX = {
  /** Decorative glow above the tiles. */
  effect: 300,
  /** Non-interactive vignette above the glow. */
  vignette: 301,
  /** Leaflet's own panes and its built-in controls. */
  leafletControls: 600,
  /** Floating app chrome drawn over the map (HUD card, data source badge). */
  chrome: 1600,
  /** Interactive controls, which must always clear the chrome. */
  controls: 1650,
} as const;

export const POPUP_MAX_WIDTH = 360;
export const POPUP_MIN_WIDTH = 240;
export const POPUP_PREFERRED_MIN_WIDTH = 310;
export const POPUP_MAX_HEIGHT = 430;
export const POPUP_MIN_HEIGHT = 200;

/** Vertical distance kept between the popup tip and the marker anchor. */
export const POPUP_ANCHOR_GAP = 28;

/**
 * Slack allowed when comparing a zoom level (or a coordinate) against the Oklahoma
 * overview. Leaflet reports fractional zooms mid-animation, so an exact match would
 * flicker the reset button on and off while a flight settles.
 */
export const VIEW_MATCH_EPSILON = 0.01;

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

/** Map pixels left over once the floating chrome is subtracted, plus where they sit. */
export interface VisibleArea {
  /** Width of the usable rectangle. */
  width: number;
  /** Height of the usable rectangle. */
  height: number;
  /** Y of the usable rectangle's top edge. */
  top: number;
  /** Y of the usable rectangle's bottom edge (the chrome starts here). */
  bottom: number;
  /** Centre of the usable rectangle, in map-container pixels. */
  centerX: number;
  centerY: number;
  /** Widest chrome column on either side, so a centred box clears both. */
  sideChrome: number;
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
 * The one place insets are turned into pixels: negative insets are ignored, insets larger
 * than the map are clipped, and the result carries the centre of the usable rectangle so
 * callers never have to re-derive it.
 */
export function resolveVisibleArea({
  width,
  height,
  insets,
}: {
  width: number;
  height: number;
  insets: ViewportInsets;
}): VisibleArea {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const top = clamp(insets.top, 0, safeHeight);
  const bottom = clamp(insets.bottom, 0, safeHeight);
  const left = clamp(insets.left, 0, safeWidth);
  const right = clamp(insets.right, 0, safeWidth);

  const areaWidth = Math.max(safeWidth - left - right, 1);
  const areaHeight = Math.max(safeHeight - top - bottom, 1);

  return {
    width: areaWidth,
    height: areaHeight,
    top,
    bottom: safeHeight - bottom,
    centerX: left + areaWidth / 2,
    centerY: top + areaHeight / 2,
    sideChrome: Math.max(left, right),
  };
}

/**
 * Popup dimensions that fit the space left between the top and bottom chrome, so a spot's
 * detail panel never runs off the screen and scrolls internally instead.
 *
 * `POPUP_MIN_WIDTH` / `POPUP_MIN_HEIGHT` act as floors, so on a viewport narrower than the
 * chrome-free budget the popup keeps its readable size and Leaflet autopans instead.
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
  const area = resolveVisibleArea({ width, height, insets });
  const side = Math.max(area.sideChrome, MAP_OVERLAY_INSETS.side);

  const maxWidth = Math.round(clamp(safeWidth - side * 2, POPUP_MIN_WIDTH, POPUP_MAX_WIDTH));

  return {
    maxWidth,
    minWidth: Math.min(POPUP_PREFERRED_MIN_WIDTH, maxWidth),
    maxHeight: Math.round(
      clamp(area.height - POPUP_ANCHOR_GAP, POPUP_MIN_HEIGHT, POPUP_MAX_HEIGHT),
    ),
  };
}

/**
 * Works out where the map should settle when a spot is picked: the spot is centred inside
 * the chrome-free strip and pushed into the lower half of that strip so the popup rendered
 * above its marker still fits between the top badges and the bottom sheet.
 *
 * `markerPoint` plus `centerOffset` always lands on the centre of the map container, so
 * callers can nudge the view by whole pixels without rounding drift.
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
  const area = resolveVisibleArea({ width, height, insets });
  const edge = MAP_OVERLAY_INSETS.side;

  const popup = resolveSpotPopupFrame({ width: safeWidth, height: safeHeight, insets });

  const markerX = area.centerX;
  const markerY = clamp(
    area.top + popup.maxHeight + POPUP_ANCHOR_GAP,
    Math.max(area.centerY, area.top + edge),
    Math.max(area.bottom - edge, area.centerY),
  );

  const markerPoint = { x: Math.round(markerX), y: Math.round(markerY) };

  return {
    popup,
    markerPoint,
    centerOffset: {
      x: Math.round(safeWidth / 2) - markerPoint.x,
      y: Math.round(safeHeight / 2) - markerPoint.y,
    },
    zoom: clamp(Math.max(currentZoom, SPOT_FOCUS_ZOOM), minZoom, maxZoom),
  };
}

export interface ZoomControlState {
  canZoomIn: boolean;
  canZoomOut: boolean;
  canResetView: boolean;
}

/** A button in the map's own zoom stack, described without any DOM or Leaflet types. */
export interface ZoomControlButton {
  id: 'in' | 'out' | 'reset';
  /** Glyph shown inside the button. */
  glyph: string;
  /** Accessible name, reused as the tooltip. */
  label: string;
  enabled: boolean;
}

/** True when two numbers agree within `VIEW_MATCH_EPSILON`. */
function matches(value: number, target: number): boolean {
  return Math.abs(value - target) <= VIEW_MATCH_EPSILON;
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
    !matches(zoom, OKLAHOMA_MAP_VIEW.zoom) ||
    (center !== undefined &&
      (!matches(center.lat, OKLAHOMA_MAP_VIEW.center.lat) ||
        !matches(center.lng, OKLAHOMA_MAP_VIEW.center.lng)));

  return {
    canZoomIn: zoom < maxZoom - VIEW_MATCH_EPSILON,
    canZoomOut: zoom > minZoom + VIEW_MATCH_EPSILON,
    canResetView: movedFromOverview,
  };
}

/**
 * The zoom stack's buttons in render order. Kept separate from the component so the stack
 * can be asserted without mounting Leaflet, and so the labels stay in one place.
 */
export function resolveZoomControlButtons(state: ZoomControlState): ZoomControlButton[] {
  return [
    { id: 'in', glyph: '+', label: 'Zoom in', enabled: state.canZoomIn },
    { id: 'out', glyph: '−', label: 'Zoom out', enabled: state.canZoomOut },
    { id: 'reset', glyph: '⟲', label: 'Reset map view', enabled: state.canResetView },
  ];
}