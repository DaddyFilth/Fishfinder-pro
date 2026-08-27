'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import AITripPlanner from "@/components/AITripPlanner";
import MapView from "@/components/MapView";
import SpeciesTab from "@/components/SpeciesTab";
import CatchesTab from "@/components/CatchesTab";
import BiteTimesTab from "@/components/BiteTimesTab";
import WeatherTab from "@/components/WeatherTab";
import SocialTab from "@/components/SocialTab";

const MapWrapper = dynamic(() => import('@/components/MapWrapper'), { ssr: false });

interface Spot { id: string; name: string; lat: number; lng: number; water_type: string; spot_type: string; }

async function getSpots(): Promise<Spot[]> {
  try {
    const res = await fetch('/api/spots', { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default function MobilePage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [tab, setTab] = useState<'map'|'log'|'ai'|'top'|'species'|'catches'|'bitetime'|'weather'|'social'|'settings'>('map');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<Spot|null>(null);

  useEffect(() => {
    getSpots().then(setSpots);
  }, []);

  const tabs = [
{ id: "map",      icon: "🗺",  label: "Map"      },
{ id: "log",      icon: "📓",  label: "Logbook"  },
{ id: "ai",       icon: "🤖",  label: "AI"       },
{ id: "top",      icon: "🏆",  label: "Top Spots"},
{ id: "species",  icon: "🐠",  label: "Species"  },
{ id: "settings", icon: "⚙️", label: "Settings" },
{ id: "bitetime", icon: "⏱",  label: "Bite Time"},
{ id: "weather",  icon: "🌤",  label: "Weather"  },
{ id: "social",   icon: "👥",  label: "Social"   },
{ id: "catches",  icon: "🐟",  label: "Catches"  },
] as const;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', background:'#030712', color:'white', fontFamily:'system-ui,sans-serif', overflow:'hidden' }}>

      {/* HEADER */}
      <header style={{ background:'#0a0f1e', borderBottom:'1px solid #1e293b', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'52px', flexShrink:0, zIndex:40 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'20px' }}>🎣</span>
          <span style={{ fontSize:'16px', fontWeight:'800', background:'linear-gradient(90deg,#22d3ee,#0ea5e9)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>FishFinder Pro</span>
          <span style={{ background:'#0c4a6e', color:'#7dd3fc', fontSize:'8px', padding:'2px 5px', borderRadius:'8px', fontWeight:'bold' }}>BETA</span>
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <span style={{ fontSize:'10px', color:'#22c55e' }}>● LIVE</span>
          <span style={{ fontSize:'18px', cursor:'pointer' }}>🔔</span>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex:1, position:'relative', overflow:'hidden' }}>

        {/* MAP TAB */}
        {tab === 'map' && (
          <div style={{ position:'absolute', inset:0 }}>
            <MapWrapper spots={spots} />

            {/* Floating spot count badge */}
            <div style={{ position:'absolute', top:'12px', left:'12px', background:'rgba(10,15,30,0.9)', border:'1px solid #1e293b', borderRadius:'20px', padding:'6px 12px', fontSize:'11px', color:'#94a3b8', zIndex:10, backdropFilter:'blur(8px)' }}>
              📍 {spots.length} spots loaded
            </div>

            {/* Floating layer toggle */}
            <div style={{ position:'absolute', top:'12px', right:'12px', display:'flex', flexDirection:'column', gap:'6px', zIndex:10 }}>
              {['🗺','📏','🌡','📍'].map((icon, i) => (
                <button key={i} style={{ width:'36px', height:'36px', background:'rgba(10,15,30,0.9)', border:'1px solid #1e293b', borderRadius:'8px', fontSize:'16px', cursor:'pointer', backdropFilter:'blur(8px)' }}>
                  {icon}
                </button>
              ))}
            </div>

            {/* Slide-up sheet handle */}
            <div
              onClick={() => setSheetOpen(!sheetOpen)}
              style={{ position:'absolute', bottom:0, left:0, right:0, background:'#0a0f1e', borderTop:'1px solid #1e293b', borderRadius:'16px 16px 0 0', padding:'8px 0 0', cursor:'pointer', zIndex:20, transition:'transform 0.3s ease' }}
            >
              <div style={{ width:'36px', height:'4px', background:'#334155', borderRadius:'2px', margin:'0 auto 10px' }} />
              {!sheetOpen && (
                <div style={{ padding:'0 16px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'12px', color:'#64748b' }}>🏆 Top Spots Today</span>
                  <span style={{ fontSize:'11px', color:'#0ea5e9' }}>Show ↑</span>
                </div>
              )}
              {sheetOpen && (
                <div style={{ padding:'0 16px 16px', maxHeight:'45dvh', overflowY:'auto' }}>
                  <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'10px', display:'flex', justifyContent:'space-between' }}>
                    <span>🏆 TOP SPOTS TODAY</span>
                    <span style={{ color:'#0ea5e9' }}>Hide ↓</span>
                  </div>
                  {spots.slice(0,8).map((s, i) => (
                    <div key={s.id} onClick={e => { e.stopPropagation(); setSelectedSpot(s); }}
                      style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid #0f172a', cursor:'pointer' }}>
                      <span style={{ color:'#475569', fontSize:'12px', minWidth:'18px' }}>#{i+1}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'13px', color:'#e2e8f0', fontWeight:'600' }}>{s.name}</div>
                        <div style={{ fontSize:'10px', color:'#475569', marginTop:'2px' }}>{s.water_type} · {s.spot_type}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:'18px', fontWeight:'bold', color:'#22c55e' }}>82</div>
                        <div style={{ fontSize:'8px', color:'#475569' }}>SCORE</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* LOGBOOK TAB */}
        {tab === 'log' && (
          <div style={{ padding:'16px', overflowY:'auto', height:'100%' }}>
            <div style={{ fontSize:'14px', fontWeight:'bold', color:'#22d3ee', marginBottom:'12px' }}>📓 My Logbook</div>
            <div style={{ background:'#0a0f1e', border:'1px solid #1e293b', borderRadius:'12px', padding:'16px', textAlign:'center' }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>🎣</div>
              <div style={{ color:'#64748b', fontSize:'13px' }}>No catches logged yet</div>
              <button style={{ marginTop:'12px', background:'linear-gradient(135deg,#0369a1,#7c3aed)', color:'white', border:'none', padding:'10px 20px', borderRadius:'20px', fontSize:'12px', fontWeight:'bold', cursor:'pointer' }}>
                + Log a Catch
              </button>
            </div>
          </div>
        )}

        {/* AI TAB */}
        {tab === 'ai' && (
          <div style={{ padding:'16px', overflowY:'auto', height:'100%' }}>
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
            <div style={{ fontSize:'14px', fontWeight:'bold', color:'#22d3ee', marginBottom:'12px' }}>🏆 Ptop Spots</div>
            {spots.slice(0,20).map((s, i) => (
              <div key={s.id} style={{ background:'#0a0f1e', border:'1px solid #1e293b', borderRadius:'10px', padding:'12px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ fontSize:'20px', fontWeight:'bold', color:'#334155', minWidth:'28px' }}>#{i+1}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', color:'#e2e8f0', fontWeight:'600' }}>{s.name}</div>
                  <div style={{ fontSize:'10px', color:'#475569', marginTop:'2px' }}>{s.water_type} · {s.spot_type}</div>
                </div>
                <div style={{ background:'#14532d', color:'#4ade80', fontSize:'14px', fontWeight:'bold', padding:'4px 10px', borderRadius:'16px' }}>82</div>
              </div>
            ))}
          </div>
        )}

        {/* SPECIES TAB */}
{/* CATCHES TAB */}
{tab === 'catches' && <CatchesTab />}
{/* BITE TIMES TAB */}
{tab === 'bitetime' && <BiteTimesTab />}
{/* WEATHER TAB */}
{tab === 'weather' && <WeatherTab />}
{/* SOCIAL TAB */}
{tab === 'social' && <SocialTab />}
        {tab === 'species' && (
          <SpeciesTab />
        )}
        {/* SETTINGS TAB */}
        {tab === 'settings' && (
          <div style={{ padding:'16px', overflowY:'auto', height:'100%' }}>
            <div style={{ fontSize:'14px', fontWeight:'bold', color:'#22d3ee', marginBottom:'12px' }}>⚙️ Settings</div>
            {[['🔎','Notifications','Push alerts for hot bites'],['📍','Location','Use GPS for nearby spots'],['🌡','Units','Imperial (lbs, ft, °F)'],['🗺','Map Style','Dark (default)'],['🔁','Auto-refresh','Every 30 minutes']].map(([icon,title,sub]) => (
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

      {/* BOTTOM NAV */}
      <nav style={{ background:'#0a0f1e', borderTop:'1px solid #1e293b', display:'flex', height:'60px', flexShrink:0, zIndex:40, paddingBottom:'env(safe-area-inset-bottom)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSheetOpen(false); }}
            style={{ flex:1, background:'none', border:'none', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'2px', cursor:'pointer', color: tab === t.id ? '#22d3ee' : '#475569', transition:'color 0.15s' }}>
            <span style={{ fontSize:'20px' }}>{t.icon}</span>
            <span style={{ fontSize:'9px', fontWeight: tab === t.id ? 'bold' : 'normal' }}>{t.label}</span>
            {tab === t.id && <div style={{ position:'absolute', bottom:'58px', width:'24px', height:'2px', background:'#22d3ee', borderRadius:'1px' }} />}
          </button>
        ))}
      </nav>
    </div>
  );
}
