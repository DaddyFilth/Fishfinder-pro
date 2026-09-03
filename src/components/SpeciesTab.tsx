'use client';
/* eslint-disable @next/next/no-img-element -- catalog images are local static field-guide assets. */
import { useMemo, useState } from 'react';
import { speciesForCoordinates, type Coordinates } from '@/lib/region';
import {
  SPECIES,
  SPECIES_FILTERS,
  SPECIES_GROUP_FILTERS,
  STATE_FILTERS,
  type Species,
  type SpeciesFilter,
  type SpeciesGroupFilter,
  type SpeciesStateFilter,
} from '@/lib/speciesCatalog';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function SpeciesTab({ coordinates }: { coordinates?: Coordinates | null }) {
  const [filter, setFilter] = useState<SpeciesFilter>('All');
  const [groupFilter, setGroupFilter] = useState<SpeciesGroupFilter>('All');
  const [stateFilter, setStateFilter] = useState<SpeciesStateFilter>('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Species | null>(null);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const regionalSpecies = useMemo(() => speciesForCoordinates(SPECIES, coordinates), [coordinates]);
  const filtered = regionalSpecies.filter((species) => {
    const matchesFilter = filter === 'All' || species.habitat === filter;
    const matchesGroup = groupFilter === 'All' || species.group === groupFilter;
    const matchesState = stateFilter === 'All' || species.states.includes(stateFilter);
    const matchesSearch = !normalizedSearch ||
      species.name.toLocaleLowerCase().includes(normalizedSearch) ||
      species.scientificName.toLocaleLowerCase().includes(normalizedSearch) ||
      species.aliases.some((alias) => alias.toLocaleLowerCase().includes(normalizedSearch));

    return matchesFilter && matchesGroup && matchesState && matchesSearch;
  });

  if (selected) {
    return (
      <div style={{ height: '100%', overflowY: 'auto', background: '#060d1a' }}>
        <div style={{ background: 'linear-gradient(180deg,#0c1e3a,#060d1a)', padding: '16px', borderBottom: '1px solid #1e293b' }}>
          <button
            onClick={() => setSelected(null)}
            style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '12px', cursor: 'pointer', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ← Back to Species
          </button>
          <img
            src={selected.image}
            alt={selected.imageAlt}
            style={{ width: '100%', height: '152px', display: 'block', objectFit: 'cover', objectPosition: 'center', borderRadius: '12px', marginBottom: '12px', border: '1px solid #1e4080' }}
          />
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e2e8f0' }}>{selected.name}</div>
          <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '8px' }}>{selected.scientificName}</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ background: '#0c4a6e', color: '#7dd3fc', fontSize: '10px', padding: '3px 8px', borderRadius: '10px' }}>{selected.habitat}</span>
            <span style={{ background: '#312e81', color: '#c4b5fd', fontSize: '10px', padding: '3px 8px', borderRadius: '10px' }}>{selected.group}</span>
            <span style={{ background: selected.difficulty === 'Easy' ? '#14532d' : selected.difficulty === 'Medium' ? '#713f12' : '#7f1d1d', color: selected.difficulty === 'Easy' ? '#4ade80' : selected.difficulty === 'Medium' ? '#fbbf24' : '#f87171', fontSize: '10px', padding: '3px 8px', borderRadius: '10px' }}>{selected.difficulty}</span>
            <span style={{ background: '#1e1b4b', color: '#a5b4fc', fontSize: '10px', padding: '3px 8px', borderRadius: '10px' }}>Record: {selected.record}</span>
          </div>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '10px' }}>MONTHLY ACTIVITY</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '50px' }}>
              {selected.activity.map((value, index) => (
                <div key={`${selected.id}-${MONTHS[index]}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div style={{ width: '100%', background: `rgba(14,165,233,${value / 10})`, border: `1px solid rgba(14,165,233,${value / 8})`, borderRadius: '3px 3px 0 0', height: `${value * 5}px`, transition: 'height 0.3s' }} />
                  <div style={{ fontSize: '7px', color: '#475569' }}>{MONTHS[index]}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '10px' }}>BEST BAITS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selected.bestBait.map((bait) => <span key={bait} style={{ background: '#0f2744', border: '1px solid #1e4080', color: '#93c5fd', fontSize: '11px', padding: '5px 10px', borderRadius: '20px' }}>{bait}</span>)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'BEST TIME', value: selected.bestTime },
              { label: 'DEPTH RANGE', value: selected.depth },
              { label: 'PEAK SEASON', value: selected.season.join(', ') },
              { label: 'HABITAT', value: selected.habitatNotes },
            ].map((stat) => (
              <div key={stat.label} style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '4px' }}>{stat.label}</div>
                <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.3 }}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'linear-gradient(135deg,#0c1e3a,#0a0f1e)', border: '1px solid #1e4080', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 'bold', marginBottom: '8px' }}>PRO TIP</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>{selected.tips}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#060d1a' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#22d3ee', marginBottom: '8px' }}>Species Guide</div>
        <input
          aria-label="Search fish species"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search species..."
          style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#e2e8f0', marginBottom: '8px', boxSizing: 'border-box' }}
        />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '8px' }}>
            STATE COVERAGE
            <select
              aria-label="Filter species by state"
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value as SpeciesStateFilter)}
              style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', color: '#cbd5e1', fontWeight: 'normal' }}
            >
              <option value="All">All states</option>
              {STATE_FILTERS.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
            </select>
          </label>
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>WATER TYPE</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {SPECIES_FILTERS.map((speciesFilter) => (
            <button
              key={speciesFilter}
              aria-pressed={filter === speciesFilter}
              onClick={() => setFilter(speciesFilter)}
              style={{ background: filter === speciesFilter ? '#0ea5e9' : '#0f172a', border: `1px solid ${filter === speciesFilter ? '#0ea5e9' : '#334155'}`, color: filter === speciesFilter ? 'white' : '#94a3b8', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', cursor: 'pointer', fontWeight: filter === speciesFilter ? 'bold' : 'normal' }}
            >
              {speciesFilter}
            </button>
          ))}
          </div>
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>SPECIES GROUP</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {SPECIES_GROUP_FILTERS.map((speciesGroup) => (
              <button
                key={speciesGroup}
                aria-pressed={groupFilter === speciesGroup}
                onClick={() => setGroupFilter(speciesGroup)}
                style={{ background: groupFilter === speciesGroup ? '#7c3aed' : '#0f172a', border: `1px solid ${groupFilter === speciesGroup ? '#7c3aed' : '#334155'}`, color: groupFilter === speciesGroup ? 'white' : '#94a3b8', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', cursor: 'pointer', fontWeight: groupFilter === speciesGroup ? 'bold' : 'normal' }}
              >
                {speciesGroup}
              </button>
            ))}
          </div>
        </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map((species) => (
          <button
            key={species.id}
            onClick={() => setSelected(species)}
            style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.2s' }}
          >
            <img
              src={species.image}
              alt={species.imageAlt}
              width={72}
              height={56}
              style={{ width: '72px', height: '56px', flexShrink: 0, borderRadius: '8px', objectFit: 'cover', border: '1px solid #1e4080' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '2px' }}>{species.name}</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', marginBottom: '6px' }}>{species.scientificName}</div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                <span style={{ background: '#0c4a6e', color: '#7dd3fc', fontSize: '9px', padding: '2px 6px', borderRadius: '8px' }}>{species.habitat}</span>
                <span style={{ background: '#312e81', color: '#c4b5fd', fontSize: '9px', padding: '2px 6px', borderRadius: '8px' }}>{species.group}</span>
                <span style={{ background: species.difficulty === 'Easy' ? '#14532d' : species.difficulty === 'Medium' ? '#713f12' : '#7f1d1d', color: species.difficulty === 'Easy' ? '#4ade80' : species.difficulty === 'Medium' ? '#fbbf24' : '#f87171', fontSize: '9px', padding: '2px 6px', borderRadius: '8px' }}>{species.difficulty}</span>
                <span style={{ background: '#1e1b4b', color: '#a5b4fc', fontSize: '9px', padding: '2px 6px', borderRadius: '8px' }}>Record: {species.record}</span>
              </div>
            </div>
            <div aria-hidden="true" style={{ color: '#64748b', fontSize: '16px' }}>›</div>
          </button>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0', fontSize: '13px' }}>No species found</div>}
      </div>
    </div>
  );
}
