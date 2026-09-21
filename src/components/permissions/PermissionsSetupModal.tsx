'use client';

import React, { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

export function PermissionsSetupModal() {
  const {
    setupCompleted,
    gpsStatus,
    notificationStatus,
    requestGps,
    requestNotifications,
    completeSetup,
  } = usePermissions();

  const [loading, setLoading] = useState(false);

  if (setupCompleted) return null;

  const handleEnableAll = async () => {
    setLoading(true);
    await requestGps();
    await requestNotifications();
    completeSetup();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-cyan-500/20 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <h2 className="text-xl font-bold text-cyan-400">Welcome to SeamCast</h2>
        <p className="mt-2 text-sm text-slate-300">
          Enable GPS and notifications to receive real-time Oklahoma lake alerts, water conditions, and nearby spot navigation.
        </p>

        <div className="my-6 space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-slate-800/80 p-3">
            <div>
              <p className="text-sm font-semibold">GPS Location</p>
              <p className="text-xs text-slate-400">Nearby lakes, boat ramps, and spot capture</p>
            </div>
            <span className="text-xs font-mono text-cyan-300 capitalize">{gpsStatus}</span>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-800/80 p-3">
            <div>
              <p className="text-sm font-semibold">Weather Alerts</p>
              <p className="text-xs text-slate-400">Severe wind, storms, and peak feeding times</p>
            </div>
            <span className="text-xs font-mono text-cyan-300 capitalize">{notificationStatus}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleEnableAll}
            disabled={loading}
            className="w-full rounded-xl bg-cyan-600 py-3 font-semibold text-white shadow-lg hover:bg-cyan-500 active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? 'Requesting Permissions...' : 'Enable GPS & Notifications'}
          </button>
          <button
            type="button"
            onClick={completeSetup}
            className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-200"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
