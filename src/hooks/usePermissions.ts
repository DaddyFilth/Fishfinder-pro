'use client';

import { useState, useEffect, useCallback } from 'react';

export type PermissionStatusType = 'granted' | 'denied' | 'prompt' | 'unsupported';

interface PermissionsState {
  gpsStatus: PermissionStatusType;
  notificationStatus: PermissionStatusType;
  gpsEnabled: boolean;
  notificationsEnabled: boolean;
  setupCompleted: boolean;
  coords: { latitude: number; longitude: number } | null;
  error: string | null;
}

const STORAGE_KEY = 'seamcast_permissions_v2';

function isSecurePermissionContext() {
  return typeof window !== 'undefined' && (window.isSecureContext || window.location.hostname === 'localhost');
}

function getInitialPreferences() {
  if (typeof window === 'undefined') return {};
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    return cached ? JSON.parse(cached) as Partial<PermissionsState> : {};
  } catch {
    return {};
  }
}

// The Notification API reports 'default' before the user has answered, which is
// not part of PermissionStatusType; 'prompt' is the equivalent state.
export function toPermissionStatusType(permission: NotificationPermission): PermissionStatusType {
  return permission === 'default' ? 'prompt' : permission;
}

export function usePermissions() {
  const [state, setState] = useState<PermissionsState>(() => {
    const preferences = getInitialPreferences();
    return {
      gpsStatus: 'prompt',
      notificationStatus: typeof window !== 'undefined' && 'Notification' in window
        ? toPermissionStatusType(window.Notification.permission)
        : 'unsupported',
      gpsEnabled: !!preferences.gpsEnabled,
      notificationsEnabled: !!preferences.notificationsEnabled,
      setupCompleted: !!preferences.setupCompleted,
      coords: null,
      error: null,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          setState((prev) => ({ ...prev, gpsStatus: status.state as PermissionStatusType }));
          status.onchange = () => {
            setState((prev) => ({ ...prev, gpsStatus: status.state as PermissionStatusType }));
          };
        })
        .catch(() => {
          setState((prev) => ({ ...prev, gpsStatus: 'prompt' }));
        });
    }

  }, []);

  const persistSettings = useCallback((updates: Partial<PermissionsState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            gpsEnabled: next.gpsEnabled,
            notificationsEnabled: next.notificationsEnabled,
            setupCompleted: next.setupCompleted,
          }),
        );
      } catch {
        // Ignore storage failures; the in-memory state remains authoritative.
      }
      return next;
    });
  }, []);

  const requestGps = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setState((prev) => ({ ...prev, gpsStatus: 'unsupported', gpsEnabled: false, error: 'GPS is not supported on this device.' }));
      return false;
    }
    if (!isSecurePermissionContext()) {
      setState((prev) => ({ ...prev, gpsStatus: 'denied', gpsEnabled: false, error: 'Location requires HTTPS or localhost.' }));
      persistSettings({ gpsEnabled: false });
      return false;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState((prev) => ({
            ...prev,
            gpsStatus: 'granted',
            gpsEnabled: true,
            coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
            error: null,
          }));
          persistSettings({ gpsEnabled: true });
          resolve(true);
        },
        (err) => {
          const isDenied = err.code === err.PERMISSION_DENIED;
          const message = isDenied
            ? 'Location access is blocked. Re-enable it in your browser or device settings.'
            : err.message || 'Unable to determine your location.';
          setState((prev) => ({
            ...prev,
            gpsStatus: isDenied ? 'denied' : prev.gpsStatus,
            gpsEnabled: false,
            error: message,
          }));
          persistSettings({ gpsEnabled: false });
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    });
  }, [persistSettings]);

  const requestNotifications = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setState((prev) => ({ ...prev, notificationStatus: 'unsupported', notificationsEnabled: false, error: 'Notifications are not supported in this app shell.' }));
      persistSettings({ notificationsEnabled: false });
      return false;
    }
    if (!isSecurePermissionContext()) {
      setState((prev) => ({ ...prev, notificationStatus: 'denied', notificationsEnabled: false, error: 'Notifications require HTTPS or localhost.' }));
      persistSettings({ notificationsEnabled: false });
      return false;
    }
    if (Notification.permission === 'denied') {
      setState((prev) => ({ ...prev, notificationStatus: 'denied', notificationsEnabled: false, error: 'Notifications are blocked. Re-enable them in your browser or device settings.' }));
      persistSettings({ notificationsEnabled: false });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setState((prev) => ({
        ...prev,
        notificationStatus: toPermissionStatusType(permission),
        notificationsEnabled: granted,
        error: granted ? null : 'Notifications were not enabled.',
      }));
      persistSettings({ notificationsEnabled: granted });
      return granted;
    } catch {
      setState((prev) => ({ ...prev, notificationStatus: 'denied', notificationsEnabled: false, error: 'Failed to request notifications.' }));
      persistSettings({ notificationsEnabled: false });
      return false;
    }
  }, [persistSettings]);

  const toggleGps = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      persistSettings({ gpsEnabled: false });
      return;
    }
    await requestGps();
  }, [requestGps, persistSettings]);

  const completeSetup = useCallback(() => {
    persistSettings({ setupCompleted: true });
  }, [persistSettings]);

  return { ...state, requestGps, requestNotifications, toggleGps, completeSetup };
}

export default usePermissions;
