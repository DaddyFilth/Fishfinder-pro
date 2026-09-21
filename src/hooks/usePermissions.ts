'use client';

import { useState, useEffect, useCallback } from 'react';

export type PermissionStatusType = 'granted' | 'denied' | 'prompt' | 'unsupported';

interface PermissionsState {
  gpsStatus: PermissionStatusType;
  notificationStatus: PermissionStatusType;
  gpsEnabled: boolean;
  setupCompleted: boolean;
  coords: { latitude: number; longitude: number } | null;
  error: string | null;
}

const STORAGE_KEY = 'seamcast_permissions_v1';

function getInitialPermissionsState(): PermissionsState {
  let gpsEnabled = false;
  let setupCompleted = false;
  let notificationStatus: PermissionStatusType = 'prompt';

  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        gpsEnabled = !!parsed.gpsEnabled;
        setupCompleted = !!parsed.setupCompleted;
      }
    } catch {}

    if ('Notification' in window) {
      notificationStatus = Notification.permission as PermissionStatusType;
    } else {
      notificationStatus = 'unsupported';
    }
  }

  return {
    gpsStatus: 'prompt',
    notificationStatus,
    gpsEnabled,
    setupCompleted,
    coords: null,
    error: null,
  };
}

export function usePermissions() {
  const [state, setState] = useState<PermissionsState>(getInitialPermissionsState);

  useEffect(() => {
    if (typeof window === 'undefined' || !('permissions' in navigator)) return;

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
  }, []);

  const persistSettings = useCallback((updates: Partial<PermissionsState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            gpsEnabled: next.gpsEnabled,
            setupCompleted: next.setupCompleted,
          })
        );
      } catch {}
      return next;
    });
  }, []);

  const requestGps = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setState((prev) => ({ ...prev, gpsStatus: 'unsupported', error: 'GPS unsupported on device' }));
      return false;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState((prev) => ({
            ...prev,
            gpsStatus: 'granted',
            gpsEnabled: true,
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            error: null,
          }));
          persistSettings({ gpsEnabled: true });
          resolve(true);
        },
        (err) => {
          const isDenied = err.code === err.PERMISSION_DENIED;
          setState((prev) => ({
            ...prev,
            gpsStatus: isDenied ? 'denied' : prev.gpsStatus,
            gpsEnabled: false,
            error: err.message,
          }));
          persistSettings({ gpsEnabled: false });
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    });
  }, [persistSettings]);

  const requestNotifications = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setState((prev) => ({ ...prev, notificationStatus: 'unsupported' }));
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({
        ...prev,
        notificationStatus: permission as PermissionStatusType,
      }));
      return permission === 'granted';
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to request notifications' }));
      return false;
    }
  }, []);

  const toggleGps = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      persistSettings({ gpsEnabled: false });
      return;
    }

    if (state.gpsStatus !== 'granted') {
      const approved = await requestGps();
      if (!approved && state.gpsStatus === 'denied') {
        alert('Location access is blocked. Please re-enable location in your browser or device settings.');
      }
      return;
    }

    persistSettings({ gpsEnabled: true });
    await requestGps();
  }, [state.gpsStatus, requestGps, persistSettings]);

  const completeSetup = useCallback(() => {
    persistSettings({ setupCompleted: true });
  }, [persistSettings]);

  return {
    ...state,
    requestGps,
    requestNotifications,
    toggleGps,
    completeSetup,
  };
}

export default usePermissions;
