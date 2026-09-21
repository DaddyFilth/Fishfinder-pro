'use client';

import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

export function GpsToggle() {
  const { gpsEnabled, gpsStatus, toggleGps, coords, error } = usePermissions();

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex items-center justify-between">
        <label htmlFor="gps-toggle" className="text-sm font-medium text-slate-200 cursor-pointer">
          GPS Tracking
        </label>
        <button
          id="gps-toggle"
          type="button"
          role="switch"
          aria-checked={gpsEnabled}
          onClick={() => toggleGps(!gpsEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            gpsEnabled ? 'bg-cyan-600' : 'bg-slate-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              gpsEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {gpsEnabled && coords && (
        <p className="text-[11px] font-mono text-cyan-400 mt-1">
          {coords.latitude.toFixed(4)}° N, {coords.longitude.toFixed(4)}° W
        </p>
      )}

      {error && !gpsEnabled && (
        <p className="text-[11px] text-amber-400 mt-1">
          {gpsStatus === 'denied' ? 'Permission blocked in settings' : error}
        </p>
      )}
    </div>
  );
}
