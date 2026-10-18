import { describe, expect, it } from 'vitest';
import { resolvePopupGesture } from './popupGesture';

/** A panel whose content overflows by 500px, so the middle of the content can still scroll. */
const scrollable = { scrollHeight: 900, clientHeight: 400 };

describe('resolvePopupGesture', () => {
  it('pans the map for sideways sweeps no matter how the panel scrolls', () => {
    expect(resolvePopupGesture({ dx: 40, dy: -6, scrollTop: 120, ...scrollable })).toBe('pan');
  });

  it('scrolls the panel while there is content left in the drag direction', () => {
    expect(resolvePopupGesture({ dx: 2, dy: 60, scrollTop: 120, ...scrollable })).toBe('scroll');
    expect(resolvePopupGesture({ dx: -2, dy: -60, scrollTop: 120, ...scrollable })).toBe('scroll');
  });

  it('pans the map when the panel has nothing to scroll', () => {
    expect(
      resolvePopupGesture({ dx: 0, dy: 60, scrollTop: 0, scrollHeight: 380, clientHeight: 400 }),
    ).toBe('pan');
  });

  it('hands the gesture to the map when dragging past the top of the content', () => {
    expect(resolvePopupGesture({ dx: 1, dy: 50, scrollTop: 0, ...scrollable })).toBe('pan');
  });

  it('hands the gesture to the map when dragging past the end of the content', () => {
    expect(resolvePopupGesture({ dx: 1, dy: -50, scrollTop: 500, ...scrollable })).toBe('pan');
  });

  it('keeps scrolling the panel when it is parked in the middle', () => {
    expect(
      resolvePopupGesture({ dx: 1, dy: -30, scrollTop: 500, scrollHeight: 1400, clientHeight: 400 }),
    ).toBe('scroll');
  });
});
