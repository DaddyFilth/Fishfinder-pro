'use client';

import { usePermissions } from '@/hooks/usePermissions';

export default function PermissionStatusCard() {
  const {
    gpsStatus,
    notificationStatus,
    gpsEnabled,
    setupCompleted,
    coords,
    error,
    requestGps,
    requestNotifications,
  } = usePermissions();

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-slate-100">
      <h2 className="text-sm font-semibold text-cyan-400">Permission Debug</h2>
      <div className="mt-3 space-y-2 text-sm">
        <p>Setup completed: {String(setupCompleted)}</p>
        <p>GPS status: {gpsStatus}</p>
        <p>GPS enabled: {String(gpsEnabled)}</p>
        <p>Notification status: {notificationStatus}</p>
        <p>
          Coordinates: {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : 'none'}
        </p>
        <p>Error: {error || 'none'}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={requestGps}
          className="rounded bg-cyan-700 px-3 py-2 text-xs font-semibold text-white"
        >
          Test GPS
        </button>
        <button
          type="button"
          onClick={requestNotifications}
          className="rounded bg-cyan-700 px-3 py-2 text-xs font-semibold text-white"
        >
          Test Notifications
        </button>
      </div>
    </div>
  );
}
