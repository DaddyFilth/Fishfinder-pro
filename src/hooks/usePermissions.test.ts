import { describe, expect, it } from 'vitest';
import { toPermissionStatusType, type PermissionStatusType } from './usePermissions';

describe('toPermissionStatusType', () => {
  it('maps the un-answered browser state to prompt', () => {
    expect(toPermissionStatusType('default')).toBe('prompt');
  });

  it('passes through granted and denied unchanged', () => {
    expect(toPermissionStatusType('granted')).toBe('granted');
    expect(toPermissionStatusType('denied')).toBe('denied');
  });

  it('only ever returns states declared by PermissionStatusType', () => {
    const browserStates: NotificationPermission[] = ['default', 'granted', 'denied'];
    const statuses: PermissionStatusType[] = browserStates.map(toPermissionStatusType);

    expect(statuses).toEqual(['prompt', 'granted', 'denied']);
  });
});
