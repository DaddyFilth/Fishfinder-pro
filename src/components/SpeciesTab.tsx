'use client';
/* eslint-disable @next/next/no-img-element -- catalog images are local static field-guide assets. */
import { useMemo, useState, useEffect } from 'react';
import GearChecklist from '@/components/GearChecklist';

function getFallbackImage(speciesName: string) {
  return `/api/species-image/${encodeURIComponent(speciesName)}`;
}

import { speciesForCoordinates, type Coordinates } from '@/lib/region';
import {
  SPECIES,
  SPECIES_FILTERS,
  SPECIES_GROUP_FILTERS,
  OKLAHOMA_STATUS_FILTERS,
  type Species,
  type SpeciesFilter,
  type SpeciesGroupFilter,
  type OklahomaSpeciesStatusFilter,
  type SpeciesStateFilter,
  type FishingCondition,
  biteRateFor,
} from '@/lib/speciesCatalog';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function SpeciesTab({ coordinates }: { coordinates?: Coordinates | null }) {
  const [filter, setFilter] = useState<SpeciesFilter>('All');
  const [groupFilter, setGroupFilter] = useState<SpeciesGroupFilter>('All');
  const [statusFilter, setStatusFilter] = useState<OklahomaSpeciesStatusFilter>('All');
  const [stateFilter, setStateFilter] = useState<SpeciesStateFilter>('OK');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Species | null>(null);
  const [condition, setCondition] = useState<FishingCondition>('stable');
  const [strategy, setStrategy] = useState<string | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [checklist, setChecklist] = useState<any[] | null>(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);

  useEffect(() => {
    setStrategy(null);
    setChecklist(null);
    if (selected) {
      import('@/lib/storage').then(({ StorageManager }) => {
        StorageManager.get('STRATEGIES', selected.id).then(cached => {
          if (cached) setStrategy(cached);
        });
        StorageManager.get('CHECKLISTS', selected.id).then(cached => {
          if (cached) setChecklist(cached);
        });
      });
    }
  }, [selected]);

  async function generateStrategy() {
    if (!coordinates) return;
    setLoadingStrategy(true);
    try {
      const res = await fetch('/api/ai/species-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speciesId: selected?.id,
          lat: coordinates.lat,
          lon: coordinates.lng,
        }),
      });
      const data = await res.json();
      setStrategy(data.strategy);
      if (data.strategy && selected) {
        import('@/lib/storage').then(({ StorageManager }) => {
          StorageManager.set('STRATEGIES', selected.id, data.strategy);
        });
      }
    } catch (e) {
      console.error('Strategy error:', e);
    } finally {
      setLoadingStrategy(false);
    }
  }

  async function generateChecklist() {
    if (!coordinates || !selected) return;
    setLoadingChecklist(true);
    try {
      const res = await fetch('/api/ai/gear-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speciesId: selected.id,
          lat: coordinates.lat,
          lon: coordinates.lng,
        }),
      });
      const data = await res.json();
      setChecklist(data.checklist);
      if (data.checklist) {
        import('@/lib/storage').then(({ StorageManager }) => {
          StorageManager.set('CHECKLISTS', selected.id, data.checklist);
        });
      }
    } catch (e) {
      console.error('Checklist error:', e);
    } finally {
      setLoadingChecklist(false);
    }
  }


  const normalizedSearch = search.trim().toLocaleLowerCase();
  const regionalSpecies = useMemo(() => speciesForCoordinates(SPECIES, coordinates), [coordinates]);
  const filtered = regionalSpecies.filter((species) => {
    const matchesFilter = filter === 'All' || species.habitat === filter;
    const matchesGroup = groupFilter === 'All' || species.group === groupFilter;
    const matchesStatus = statusFilter === 'All' || species.oklahomaStatus === statusFilter;
    const matchesState = stateFilter === 'All' || species.states.includes(stateFilter);
    const matchesSearch = !normalizedSearch ||
      species.name.toLocaleLowerCase().includes(normalizedSearch) ||
      species.scientificName.toLocaleLowerCase().includes(normalizedSearch) ||
      species.aliases.some((alias) => alias.toLocaleLowerCase().includes(normalizedSearch));

    return matchesFilter && matchesGroup && matchesStatus && matchesState && matchesSearch;
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
            onError={(event) => {
              const image = event.currentTarget;
              if (image.src.endsWith(getFallbackImage(selected.name))) return;
              image.src = getFallbackImage(selected.name);
            }}
            alt={selected.imageAlt}
            style={{ width: '100%', height: '152px', display: 'block', objectFit: 'cover', objectPosition: 'center', borderRadius: '12px', marginBottom: '12px', border: '1px solid #1e4080' }}
          />
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e2e8f0' }}>{selected.name}</div>
          <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '8px' }}>{selected.scientificName}</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{ background: '#0c4a6e', color: '#7dd3fc', fontSize: '10px', padding: '3px 8px', borderRadius: '10px' }}>{selected.habitat}</span>
            <span style={{ background: '#312e81', color: '#c4b5fd', fontSize: '10px', padding: '3px 8px', borderRadius: '10px' }}>{selected.group}</span>
            <span style={{ background: selected.oklahomaStatus === 'Game fish' ? '#14532d' : selected.oklahomaStatus === 'Special concern' ? '#7f1d1d' : '#164e63', color: selected.oklahomaStatus === 'Game fish' ? '#86efac' : selected.oklahomaStatus === 'Special concern' ? '#fecaca' : '#a5f3fc', fontSize: '10px', padding: '3px 8px', borderRadius: '10px' }}>{selected.oklahomaStatus}</span>
            <span style={{ background: selected.difficulty === 'Easy' ? '#14532d' : selected.difficulty === 'Medium' ? '#713f12' : '#7f1d1d', color: selected.difficulty === 'Easy' ? '#4ade80' : selected.difficulty === 'Medium' ? '#fbbf24' : '#f87171', fontSize: '10px', padding: '3px 8px', borderRadius: '10px' }}>{selected.difficulty}</span>
            <span style={{ background: '#1e1b4b', color: '#a5b4fc', fontSize: '10px', padding: '3px 8px', borderRadius: '10px' }}>Record: {selected.record}</span>
          </div>
          <button 
            onClick={generateStrategy}
            disabled={loadingStrategy || !coordinates}
            style={{ 
              background: '#0891b2', color: 'white', border: 'none', borderRadius: '8px', 
              padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
              width: '100%', transition: 'background 0.2s', opacity: (loadingStrategy || !coordinates) ? 0.6 : 1
            }}
          >
            {loadingStrategy ? 'Consulting Master Guide...' : coordinates ? '✨ Generate AI Strategy' : 'Enable GPS for Strategy'}
          </button>
          <button 
            onClick={generateChecklist}
            disabled={loadingChecklist || !coordinates || !selected}
            style={{ 
              background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '8px', 
              padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
              marginTop: '8px', width: '100%', transition: 'all 0.2s', opacity: (loadingChecklist || !coordinates || !selected) ? 0.6 : 1
            }}
          >
            {loadingChecklist ? 'Packing Gear...' : '🎒 Generate Gear Checklist'}
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {strategy && (
            <div style={{ 
              background: 'rgba(8, 145, 178, 0.1)', border: '1px solid #0891b2', 
              borderRadius: '12px', padding: '14px', color: '#e2e8f0', 
              fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontWeight: 'bold', color: '#22d3ee', marginBottom: '8px', fontSize: '14px' }}>
                🎣 Master Guide Tactical Blueprint
              </div>
              {strategy}
            </div>
          )}
          {checklist && (
            <GearChecklist items={checklist} />
          )}
          <div style={{ background: 'linear-gradient(135deg,#082f49,#0a0f1e)', border: '1px solid #155e75', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#67e8f9', fontWeight: 'bold', marginBottom: '8px' }}>CONDITION-BASED ESTIMATE</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {(['cool', 'warming', 'stable', 'low-light', 'windy'] as FishingCondition[]).map((option) => (
                <button key={option} type="button" aria-pressed={condition === option} onClick={() => setCondition(option)} style={{ background: condition === option ? '#0891b2' : '#0f172a', border: `1px solid ${condition === option ? '#67e8f9' : '#334155'}`, color: condition === option ? '#ecfeff' : '#94a3b8', borderRadius: '999px', padding: '5px 8px', fontSize: '10px', cursor: 'pointer' }}>
                  {option.replace('-', ' ')}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><div style={{ fontSize: '9px', color: '#67e8f9' }}>ACTIVITY ESTIMATE</div><div style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 800 }}>{biteRateFor(selected, condition)}<span style={{ fontSize: '10px', color: '#94a3b8' }}>/100</span></div></div>
              <div><div style={{ fontSize: '9px', color: '#67e8f9' }}>BEST WINDOWS</div><div style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: 1.35 }}>{selected.bestTime}</div></div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '10px', color: '#cbd5e1' }}>Catalog-based target suggestions; verify live conditions before traveling.</div>
          </div>
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
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: '#060d1a', borderRadius: '16px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #1e293b', background: 'linear-gradient(180deg, #0b1b2d 0%, #081321 100%)', flexShrink: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#22d3ee', marginBottom: '8px' }}>Oklahoma Species Guide</div>
        <input
          aria-label="Search fish species"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search species..."
          style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#e2e8f0', marginBottom: '8px', boxSizing: 'border-box' }}
        />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '8px' }}>
            OKLAHOMA STATE COVERAGE
            <select
              aria-label="Filter species by state"
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value as SpeciesStateFilter)}
              style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', color: '#cbd5e1', fontWeight: 'normal' }}
            >
              <option value="OK">Oklahoma</option>
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
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>OKLAHOMA STATUS</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {OKLAHOMA_STATUS_FILTERS.map((status) => (
              <button
                key={status}
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                style={{ background: statusFilter === status ? '#0f766e' : '#0f172a', border: `1px solid ${statusFilter === status ? '#0f766e' : '#334155'}`, color: statusFilter === status ? 'white' : '#94a3b8', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', cursor: 'pointer', fontWeight: statusFilter === status ? 'bold' : 'normal' }}
              >
                {status}
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

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map((species) => (
          <button
            key={species.id}
            onClick={() => setSelected(species)}
            style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.2s' }}
          >
            <img
              src={species.image}
              onError={(event) => {
                const image = event.currentTarget;
                const fallback = getFallbackImage(species.name);
                if (image.src.endsWith(fallback)) return;
                image.src = fallback;
              }}
              alt={species.imageAlt}
              width={72}
              height={56}
              style={{ width: '72px', height: '56px', flexShrink: 0, borderRadius: '8px', objectFit: 'cover', border: '1px solid #1e4080' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '2px' }}>{species.name}</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', marginBottom: '6px' }}>{species.scientificName}</div>
              <div style={{ fontSize: '10px', color: '#67e8f9', marginBottom: '6px' }}>Bite rate {biteRateFor(species, condition)}/100 · {species.bestTime}</div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                <span style={{ background: '#0c4a6e', color: '#7dd3fc', fontSize: '9px', padding: '2px 6px', borderRadius: '8px' }}>{species.habitat}</span>
                <span style={{ background: '#312e81', color: '#c4b5fd', fontSize: '9px', padding: '2px 6px', borderRadius: '8px' }}>{species.group}</span>
                <span style={{ background: species.oklahomaStatus === 'Game fish' ? '#14532d' : species.oklahomaStatus === 'Special concern' ? '#7f1d1d' : '#164e63', color: species.oklahomaStatus === 'Game fish' ? '#86efac' : species.oklahomaStatus === 'Special concern' ? '#fecaca' : '#a5f3fc', fontSize: '9px', padding: '2px 6px', borderRadius: '8px' }}>{species.oklahomaStatus}</span>
                <span style={{ background: species.difficulty === 'Easy' ? '#14532d' : species.difficulty === 'Medium' ? '#713f12' : '#7f1d1d', color: species.difficulty === 'Easy' ? '#4ade80' : species.difficulty === 'Medium' ? '#fbbf24' : '#f87171', fontSize: '9px', padding: '2px 6px', borderRadius: '8px' }}>{species.difficulty}</span>
                <span style={{ background: '#1e1b4b', color: '#a5b4fc', fontSize: '9px', padding: '2px 6px', borderRadius: '8px' }}>Record: {species.record}</span>
              </div>
            </div>
            <div aria-hidden="true" style={{ color: '#64748b', fontSize: '16px' }}>❯</div>
          </button>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0', fontSize: '13px' }}>No species found</div>}
      </div>
    </div>
  );
}
