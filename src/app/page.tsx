'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import SpeciesTab from "@/components/SpeciesTab";
import CatchesTab from "@/components/CatchesTab";
import BiteTimesTab from "@/components/BiteTimesTab";
import WeatherTab from "@/components/WeatherTab";
import SocialTab from "@/components/SocialTab";
import { filterSpots, rankSpots, type Spot, type SpotFilter } from '@/lib/mapFilters';

const MapWrapper = dynamic(() => import('@/components/MapWrapper'), { ssr: false });

interface SpotCondition { fishing_score?: number | null }

const MAP_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'freshwater', label: 'Freshwater' },
  { id: 'lake', label: 'Lake' },
  { id: 'reservoir', label: 'Reservoir' },
  { id: 'river', label: 'River' },
] as const;

interface ScoreMap { [spotId: string]: number | undefined; }

async function getSpots(): Promise<Spot[]> {
  try {
    const res = await fetch('/api/spots', { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default function MobilePage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [scores, setScores] = useState<ScoreMap>({});
  const [tab, setTab] = useState<'map'|'ai'|'top'|'species'|'catches'|'bitetime'|'weather'|'social'|'settings'>('map');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mapFilter, setMapFilter] = useState<SpotFilter>('all');
  const [conditionScores, setConditionScores] = useState<Record<string, number>>({});
  const [loadingScores, setLoadingScores] = useState<Record<string, boolean>>({});
  const scoreFetchInFlight = useRef<Record<string, boolean>>({});

  useEffect(() => { getSpots().then(setSpots); }, []);

  useEffect(() => {
    if (spots.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const spot of spots) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/spots/${spot.id}/conditions`, { cache: 'no-store' });
          if (!res.ok) continue;
          const data = await res.json();
          if (!cancelled && typeof data.fishing_score === 'number') {
            setScores(prev => ({ ...prev, [spot.id]: data.fishing_score }));
          }
        } catch { /* leave undefined */ }
      }
    })();
    return () => { cancelled = true; };
  }, [spots]);

  const rankedSpots = [...spots].sort((a, b) => (scores[b.id] ?? -1) - (scores[a.id] ?? -1));

  useEffect(() => {
    if (!spots.length) return;

    const visibleSpots = filterSpots(spots, mapFilter);
    visibleSpots.forEach((spot) => {
      if (conditionScores[spot.id] !== undefined || scoreFetchInFlight.current[spot.id]) return;

      scoreFetchInFlight.current[spot.id] = true;
      setLoadingScores((prev) => ({ ...prev, [spot.id]: true }));

      fetch(`/api/spots/${spot.id}/conditions`)
        .then(async (res) => {
          if (!res.ok) {
            setConditionScores((prev) => ({ ...prev, [spot.id]: 0 }));
            return;
          }

          const data = (await res.json()) as SpotCondition;
          const fishingScore = typeof data.fishing_score === 'number' ? data.fishing_score : 0;
          setConditionScores((prev) => ({ ...prev, [spot.id]: fishingScore }));
        })
        .catch(() => {
          setConditionScores((prev) => ({ ...prev, [spot.id]: 0 }));
        })
        .finally(() => {
          scoreFetchInFlight.current[spot.id] = false;
          setLoadingScores((prev) => ({ ...prev, [spot.id]: false }));
        });
    });
  }, [spots, mapFilter, conditionScores]);

  const visibleSpots = filterSpots(spots, mapFilter);
  const rankedSpots = rankSpots(visibleSpots, conditionScores);
  const topSpots = rankedSpots.slice(0, 8);

  const tabs = [
<<<<<<< HEAD
    { id: "map",      icon: "🗺️",  label: "Map"       },
    { id: "ai",       icon: "🤖",  label: "AI"        },
    { id: "top",      icon: "🏆",  label: "Top Spots" },
    { id: "species",  icon: "🐠",  label: "Species"   },
    { id: "catches",  icon: "🐟",  label: "Catches"   },
    { id: "bitetime", icon: "⏱️",  label: "Bite Time" },
    { id: "weather",  icon: "🌤️",  label: "Weather"   },
    { id: "social",   icon: "👥",  label: "Social"    },
    { id: "settings", icon: "⚙️",  label: "Settings"  },
  ] as const;
>>>>>>> a110a9328e5d62d1fa726120585ff89bc9f61fcd
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', background:'#030712', color:'white', fontFamily:'system-ui,sans-serif', overflow:'hidden' }}>
      <header style={{ background:'#0a0f1e', borderBottom:'1px solid #1e293b', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'52px', flexShrink:0, zIndex:40 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'20px' }}>{'🎣'}</span>
          <span style={{ fontSize:'16px', fontWeight:'800', background:'linear-gradient(90deg,#22d3ee,#0ea5e9)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>FishFinder Pro</span>
          <span style={{ background:'#0c4a6e', color:'#7dd3fc', fontSize:'8px', padding:'2px 5px', borderRadius:'8px', fontWeight:'bold' }}>BETA</span>
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <span style={{ fontSize:'10px', color:'#22c55e' }}>{'●'} LIVE</span>
        </div>
      </header>

      <main style={{ flex:1, position:'relative', overflow:'hidden' }}>
        {tab === 'map' && (
          <div style={{ position:'absolute', inset:0 }}>
<<<<<<< HEAD
            <MapWrapper spots={spots} />
            <div style={{ position:'absolute', top:'12px', left:'12px', background:'rgba(10,15,30,0.9)', border:'1px solid #1e293b', borderRadius:'20px', padding:'6px 12px', fontSize:'11px', color:'#94a3b8', zIndex:10, backdropFilter:'blur(8px)' }}>
              {'📍'} {spots.length} spots loaded
            </div>
            <div onClick={() => setSheetOpen(!sheetOpen)}
              style={{ position:'absolute', bottom:0, left:0, right:0, background:'#0a0f1e', borderTop:'1px solid #1e293b', borderRadius:'16px 16px 0 0', padding:'8px 0 0', cursor:'pointer', zIndex:20, transition:'transform 0.3s ease' }}>
=======
            <MapWrapper spots={visibleSpots} />

            {/* Floating spot count badge */}
            <div style={{ position:'absolute', top:'12px', left:'12px', background:'rgba(10,15,30,0.9)', border:'1px solid #1e293b', borderRadius:'20px', padding:'6px 12px', fontSize:'11px', color:'#94a3b8', zIndex:10, backdropFilter:'blur(8px)' }}>
              📍 {visibleSpots.length} spots loaded
            </div>

            {/* Floating filter toggle */}
            <div style={{ position:'absolute', top:'12px', right:'12px', display:'flex', flexDirection:'column', gap:'6px', zIndex:10 }}>
              {MAP_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setMapFilter(filter.id)}
                  style={{
                    minWidth:'84px',
                    background: mapFilter === filter.id ? '#0369a1' : 'rgba(10,15,30,0.9)',
                    border: mapFilter === filter.id ? '1px solid #7dd3fc' : '1px solid #1e293b',
                    borderRadius:'8px',
                    fontSize:'10px',
                    cursor:'pointer',
                    backdropFilter:'blur(8px)',
                    color: mapFilter === filter.id ? '#e0f2fe' : '#cbd5e1',
                    padding:'6px 8px',
                    fontWeight: mapFilter === filter.id ? '700' : '500',
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Slide-up sheet handle */}
            <div
              onClick={() => setSheetOpen(!sheetOpen)}
              style={{ position:'absolute', bottom:0, left:0, right:0, background:'#0a0f1e', borderTop:'1px solid #1e293b', borderRadius:'16px 16px 0 0', padding:'8px 0 0', cursor:'pointer', zIndex:20, transition:'transform 0.3s ease' }}
            >
>>>>>>> a110a9328e5d62d1fa726120585ff89bc9f61fcd
              <div style={{ width:'36px', height:'4px', background:'#334155', borderRadius:'2px', margin:'0 auto 10px' }} />
              {!sheetOpen && (
                <div style={{ padding:'0 16px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'12px', color:'#64748b' }}>{'🏆'} Top Spots Today</span>
                  <span style={{ fontSize:'11px', color:'#0ea5e9' }}>Show {'↑'}</span>
                </div>
              )}              {sheetOpen && (
                <div style={{ padding:'0 16px 16px', maxHeight:'45dvh', overflowY:'auto' }}>
                  <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'10px', display:'flex', justifyContent:'space-between' }}>
                    <span>{'🏆'} TOP SPOTS TODAY</span>
                    <span style={{ color:'#0ea5e9' }}>Hide {'↓'}</span>
                  </div>
<<<<<<< HEAD
                  {rankedSpots.slice(0,8).map((s, i) => (
                    <div key={s.id} onClick={e => { e.stopPropagation(); setSheetOpen(false); }}
                      style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid #0f172a', cursor:'pointer' }}>
                      <span style={{ color:'#475569', fontSize:'12px', minWidth:'18px' }}>#{i+1}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'13px', color:'#e2e8f0', fontWeight:'600' }}>{s.name}</div>
                        <div style={{ fontSize:'10px', color:'#475569', marginTop:'2px' }}>{s.water_type} {'·'} {s.spot_type}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:'18px', fontWeight:'bold', color: scores[s.id]===undefined?'#475569':'#22c55e' }}>{scores[s.id] ?? '...'}</div>
                        <div style={{ fontSize:'8px', color:'#475569' }}>SCORE</div>
                      </div>
                    </div>
                  ))}
=======
                  {topSpots.length > 0 ? topSpots.map(({ spot, score }, i) => {
                    const scoreValue = loadingScores[spot.id] ? '…' : score;
                    return (
                      <div key={spot.id} onClick={e => { e.stopPropagation(); setSheetOpen(false); }}
                        style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid #0f172a', cursor:'pointer' }}>
                        <span style={{ color:'#475569', fontSize:'12px', minWidth:'18px' }}>#{i+1}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'13px', color:'#e2e8f0', fontWeight:'600' }}>{spot.name}</div>
                          <div style={{ fontSize:'10px', color:'#475569', marginTop:'2px' }}>{spot.water_type} · {spot.spot_type}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'18px', fontWeight:'bold', color:'#22c55e' }}>{scoreValue}</div>
                          <div style={{ fontSize:'8px', color:'#475569' }}>SCORE</div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ color:'#64748b', fontSize:'12px', padding:'12px 0' }}>No spots match this filter yet.</div>
                  )}
>>>>>>> a110a9328e5d62d1fa726120585ff89bc9f61fcd
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div style={{ padding:'16px', overflowY:'auto', height:'100%' }}>
            <div style={{ fontSize:'14px', fontWeight:'bold', color:'#22d3ee', marginBottom:'12px' }}>{'🤖'} AI Assistant</div>
            <div style={{ background:'#0a0f1e', border:'1px solid #1e293b', borderRadius:'12px', padding:'16px', textAlign:'center' }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>{'🤖'}</div>
              <div style={{ color:'#64748b', fontSize:'13px' }}>Select a spot on the map, then open its AI tab for fishing advice.</div>
              <button onClick={() => setTab('map')} style={{ marginTop:'12px', background:'linear-gradient(135deg,#0369a1,#7c3aed)', color:'white', border:'none', padding:'10px 20px', borderRadius:'20px', fontSize:'12px', fontWeight:'bold', cursor:'pointer' }}>
                Go to Map
              </button>
            </div>
          </div>
        )}        {tab === 'top' && (
          <div style={{ padding:'16px', overflowY:'auto', height:'100%' }}>
<<<<<<< HEAD
            <div style={{ fontSize:'14px', fontWeight:'bold', color:'#22d3ee', marginBottom:'12px' }}>{'🏆'} Top Spots</div>
            {rankedSpots.slice(0,20).map((s, i) => (
              <div key={s.id} style={{ background:'#0a0f1e', border:'1px solid #1e293b', borderRadius:'10px', padding:'12px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ fontSize:'20px', fontWeight:'bold', color:'#334155', minWidth:'28px' }}>#{i+1}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', color:'#e2e8f0', fontWeight:'600' }}>{s.name}</div>
                  <div style={{ fontSize:'10px', color:'#475569', marginTop:'2px' }}>{s.water_type} {'·'} {s.spot_type}</div>
                </div>
                <div style={{ background: scores[s.id]===undefined?'#1e293b':'#14532d', color: scores[s.id]===undefined?'#64748b':'#4ade80', fontSize:'14px', fontWeight:'bold', padding:'4px 10px', borderRadius:'16px' }}>
                  {scores[s.id] ?? '...'}
                </div>
              </div>
            ))}
=======
            <div style={{ fontSize:'14px', fontWeight:'bold', color:'#22d3ee', marginBottom:'12px' }}>🤖 AI Assistant</div>
            <div style={{ background:'#0a0f1e', border:'1px solid #1e293b', borderRadius:'12px', padding:'16px', textAlign:'center' }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>🤖</div>
              <div style={{ color:'#64748b', fontSize:'13px' }}>Select a spot on the map to get AI fishing advice</div>
            </div>
          </div>
        )}

        {/* TOP SPOTS TAB */}
        {tab === 'top' && (
          <div style={{ padding:'16px', overflowY:'auto', height:'100%' }}>
            <div style={{ fontSize:'14px', fontWeight:'bold', color:'#22d3ee', marginBottom:'12px' }}>🏆 Top Spots</div>
            {rankedSpots.length > 0 ? rankedSpots.map(({ spot, score }, i) => {
              const scoreValue = loadingScores[spot.id] ? '…' : score;
              return (
                <div key={spot.id} style={{ background:'#0a0f1e', border:'1px solid #1e293b', borderRadius:'10px', padding:'12px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'20px', fontWeight:'bold', color:'#334155', minWidth:'28px' }}>#{i+1}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', color:'#e2e8f0', fontWeight:'600' }}>{spot.name}</div>
                    <div style={{ fontSize:'10px', color:'#475569', marginTop:'2px' }}>{spot.water_type} · {spot.spot_type}</div>
                  </div>
                  <div style={{ background:'#14532d', color:'#4ade80', fontSize:'14px', fontWeight:'bold', padding:'4px 10px', borderRadius:'16px' }}>{scoreValue}</div>
                </div>
              );
            }) : (
              <div style={{ color:'#64748b', fontSize:'12px', padding:'32px 0', textAlign:'center' }}>No live scores available for the current filter.</div>
            )}
>>>>>>> a110a9328e5d62d1fa726120585ff89bc9f61fcd
          </div>
        )}

        {tab === 'catches' && <CatchesTab spots={spots} />}
        {tab === 'bitetime' && <BiteTimesTab />}
        {tab === 'weather' && <WeatherTab />}
        {tab === 'social' && <SocialTab />}
        {tab === 'species' && <SpeciesTab />}

        {tab === 'settings' && (
          <div style={{ padding:'16px', overflowY:'auto', height:'100%' }}>
            <div style={{ fontSize:'14px', fontWeight:'bold', color:'#22d3ee', marginBottom:'12px' }}>{'⚙️'} Settings</div>
            {[['🔔','Notifications','Push alerts for hot bites'],['📍','Location','Use GPS for nearby spots'],['🌡️','Units','Imperial (lbs, ft, °F)'],['🗺️','Map Style','Dark (default)'],['🔁','Auto-refresh','Every 30 minutes']].map(([icon,title,sub]) => (
              <div key={title as string} style={{ background:'#0a0f1e', border:'1px solid #1e293b', borderRadius:'10px', padding:'14px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'12px', justifyContent:'space-between' }}>
                <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                  <span style={{ fontSize:'20px' }}>{icon}</span>
                  <div>
                    <div style={{ fontSize:'13px', color:'#e2e8f0' }}>{title as string}</div>
                    <div style={{ fontSize:'10px', color:'#475569' }}>{sub as string}</div>
                  </div>
                </div>
                <div style={{ width:'40px', height:'22px', background:'#0369a1', borderRadius:'11px', position:'relative', cursor:'pointer' }}>
                  <div style={{ position:'absolute', right:'2px', top:'2px', width:'18px', height:'18px', background:'white', borderRadius:'50%' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav style={{ background:'#0a0f1e', borderTop:'1px solid #1e293b', display:'flex', height:'60px', flexShrink:0, zIndex:40, paddingBottom:'env(safe-area-inset-bottom)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSheetOpen(false); }}
            style={{ flex:1, background:'none', border:'none', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'2px', cursor:'pointer', color: tab === t.id ? '#22d3ee' : '#475569', transition:'color 0.15s', position:'relative' }}>
            <span style={{ fontSize:'20px' }}>{t.icon}</span>
            <span style={{ fontSize:'9px', fontWeight: tab === t.id ? 'bold' : 'normal' }}>{t.label}</span>
            {tab === t.id && <div style={{ position:'absolute', bottom:'58px', width:'24px', height:'2px', background:'#22d3ee', borderRadius:'1px' }} />}
          </button>
        ))}
      </nav>
    </div>
  );
}
