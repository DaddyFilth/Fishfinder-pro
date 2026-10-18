'use client';

import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { Spot } from '@/lib/mapFilters';
import { searchLocations } from '@/lib/locationSearch';
import { formatDistance } from '@/lib/nearbySpots';

/**
 * Map search bar for Oklahoma public waters.
 *
 * Typing filters the loaded catalog by name (or region/type); picking a result hands the
 * spot to the parent, which selects it so the map flies over and opens its panel. The
 * component never touches the map itself, which keeps it usable anywhere a spot list is
 * available.
 */
export default function LocationSearchBar({
  spots,
  onSelect,
  distanceMilesById,
  placeholder = 'Search Oklahoma waters by name…',
  maxResults = 8,
}: {
  spots: Spot[];
  onSelect: (spot: Spot) => void;
  /** Distances from the last GPS fix, shown next to each result when available. */
  distanceMilesById?: ReadonlyMap<string, number>;
  placeholder?: string;
  maxResults?: number;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const results = useMemo(() => searchLocations(spots, query, maxResults), [spots, query, maxResults]);
  const trimmedQuery = query.trim();
  const showResults = open && trimmedQuery.length > 0;

  const commit = useCallback(
    (spot: Spot) => {
      onSelect(spot);
      setQuery('');
      setOpen(false);
      setActiveIndex(0);
      inputRef.current?.blur();
    },
    [onSelect],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length === 0) return;
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      const match = results[activeIndex];
      if (!showResults || !match) return;
      event.preventDefault();
      commit(match);
      return;
    }

    if (event.key === 'Escape') {
      setQuery('');
      setOpen(false);
      setActiveIndex(0);
    }
  };

  return (
    <div
      style={{ position: 'relative' }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(10,15,30,0.94)',
          border: '1px solid #294452',
          borderRadius: '12px',
          padding: '2px 6px 2px 10px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 10px 26px rgba(0,0,0,0.28)',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '13px', color: '#67e8f9' }}>
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search fishing locations by name"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showResults && results[activeIndex] ? `${listId}-option-${activeIndex}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e2e8f0',
            fontSize: '13px',
            padding: '8px 0',
          }}
        />
        {query.length > 0 && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setOpen(false);
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
            style={{
              flexShrink: 0,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '999px',
              border: '1px solid #334155',
              background: 'rgba(15,23,42,0.9)',
              color: '#94a3b8',
              fontSize: '11px',
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {showResults && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching fishing locations"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            margin: 0,
            padding: '6px',
            listStyle: 'none',
            background: 'rgba(7,12,24,0.98)',
            border: '1px solid #294452',
            borderRadius: '12px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            maxHeight: 'min(48dvh, 340px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            zIndex: 10,
          }}
        >
          {results.length === 0 && (
            <li
              role="presentation"
              style={{ padding: '10px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}
            >
              No public waters match “{trimmedQuery}”. Try another lake, river, or PFA name.
            </li>
          )}

          {results.map((spot, index) => {
            const distance = distanceMilesById?.get(spot.id);
            const details = [spot.water_type, spot.spot_type, spot.region].filter(Boolean).join(' · ');

            return (
              <li
                key={spot.id}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(spot)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  background: index === activeIndex ? 'rgba(14,116,144,0.28)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#f1f5f9',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {spot.name}
                  </span>
                  {details.length > 0 && (
                    <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                      {details}
                    </span>
                  )}
                </span>
                {distance !== undefined && Number.isFinite(distance) && (
                  <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 700, color: '#67e8f9' }}>
                    {formatDistance(distance)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
