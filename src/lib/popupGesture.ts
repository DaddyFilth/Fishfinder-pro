/**
 * Touch intent for the selected-spot detail panel.
 *
 * The panel is a Leaflet popup, and Leaflet stops its touches from reaching the map, so a
 * panel that covers half the screen would otherwise be a dead zone: nothing scrolls (the
 * content fits) and nothing pans. This decides, once per gesture, whether the panel keeps
 * the gesture for its own scrolling or hands it to the map.
 */

export type PopupGestureIntent = 'scroll' | 'pan';

/** Scroll positions within a pixel of an edge count as that edge. */
const SCROLL_EPSILON = 1;

export function resolvePopupGesture({
  dx,
  dy,
  scrollTop,
  scrollHeight,
  clientHeight,
}: {
  /** Horizontal distance travelled since the gesture started. */
  dx: number;
  /** Vertical distance travelled since the gesture started. */
  dy: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): PopupGestureIntent {
  const maxScroll = Math.max(scrollHeight - clientHeight, 0);

  // Sideways sweeps and short panels have nothing for the panel to scroll: move the map.
  if (Math.abs(dx) > Math.abs(dy)) return 'pan';
  if (maxScroll <= SCROLL_EPSILON) return 'pan';

  // Dragging past the top or the end of the content continues onto the map instead of stalling.
  if (dy > 0 && scrollTop <= SCROLL_EPSILON) return 'pan';
  if (dy < 0 && scrollTop >= maxScroll - SCROLL_EPSILON) return 'pan';

  return 'scroll';
}
