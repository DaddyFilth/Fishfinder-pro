'use client';

import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

export function PermissionsSetupModal() {
  const {
    setupCompleted,
    gpsStatus,
    notificationStatus,
    requestGps,
    requestNotifications,
    completeSetup,
    error,
  } = usePermissions();

  const [busy, setBusy] = useState(false);
  const [insecureWarn, setInsecureWarn] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
      setInsecureWarn(true);
    }
  }, []);

  if (setupCompleted) return null;

  const handleEnableAll = async () => {
    setBusy(true);
    if ('Notification' in window) {
      await requestNotifications();
    }
    await requestGps();
    completeSetup();
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-cyan-500/20 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <h2 className="text-xl font-bold text-cyan-400">Welcome to SeamCast</h2>
        <p className="mt-2 text-sm text-slate-300">
          Enable GPS and notifications for real-time Oklahoma lake alerts, water conditions, and nearby spot tracking.
        </p>

        {insecureWarn && (
          <div className="my-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
            Warning: Browser blocks GPS & Notifications over LAN HTTP. Please open <strong>http://localhost:3000</strong> directly on this device or use HTTPS.
          </div>
        )}

        <div className="my-5 space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-slate-800/80 p-3">
            <div>
              <p className="text-sm font-semibold">GPS Location</p>
              <p className="text-xs text-slate-400">Lake spot navigation & ramps</p>
            </div>
            <button
              type="button"
              onClick={requestGps}
              className="rounded bg-cyan-700/60 px-3 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-600 active:scale-95 transition"
            >
              {gpsStatus === 'granted' ? 'Allowed' : 'Enable'}
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-800/80 p-3">
            <div>
              <p className="text-sm font-semibold">Alerts & Windows</p>
              <p className="text-xs text-slate-400">Severe wind & bite times</p>
            </div>
            <button
              type="button"
              onClick={requestNotifications}
              className="rounded bg-cyan-700/60 px-3 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-600 active:scale-95 transition"
            >
              {notificationStatus === 'granted' ? 'Allowed' : 'Enable'}
            </button>
          </div>
        </div>

        {error && <p className="mb-3 text-xs text-rose-400">{error}</p>}

        <button
          type="button"
          onClick={handleEnableAll}
          disabled={busy}
          className="w-full rounded-xl bg-cyan-600 py-3 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 transition"
        >
          {busy ? 'Activating...' : 'Continue'}
        </button>
        <button
          type="button"
          onClick={completeSetup}
          className="mt-2 w-full py-2 text-xs text-slate-400 hover:text-slate-200"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
export default PermissionsSetupModal;
