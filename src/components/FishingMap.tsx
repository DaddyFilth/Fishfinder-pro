'use client';
import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import BiteTimePanel from '@/components/BiteTimePanel';
import WaypointMarkers from '@/components/WaypointMarkers';
import DepthOverlay from '@/components/DepthOverlay';
import FishBot from '@/components/ai/FishBot';
import FishIdentifier from '@/components/ai/FishIdentifier';
import CatchLogger from '@/components/logbook/CatchLogger';
import SevenDayForecast from '@/components/SevenDayForecast';
import WaterTempOverlay from '@/components/WaterTempOverlay';

delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Spot { id:string; name:string; lat:number; lng:number; water_type:string; spot_type:string }
interface Cond {
  fishing_score:number; air_temp_c:number|null; water_temp_c:number|null;
  wind_speed_ms:number|null; wind_dir_deg:number|null; wave_height_m:number|null;
  wave_period_s:number|null; swell_direction_deg:number|null;
  dissolved_oxygen_mgl:number|null; flow_rate_cfs:number|null;
  water_level_m:number|null; tide_height_m:number|null; tide_type:string|null;
  pressure_hpa:number|null; humidity_pct:number|null; turbidity_ntu:number|null; ph:number|null;
  score_breakdown:{ recommendations:string[]; warnings:string[]; components:Record<string,number> };
  data_sources:string[]; cached:boolean; captured_at:string;
}
type Tab = 'score'|'water'|'atmosphere'|'marine'|'bite'|'forecast'|'log'|'ai'|'identify';

const SC = (s:number) => s>=75?'#22c55e':s>=50?'#eab308':s>=25?'#f97316':'#ef4444';
const SL = (s:number) => s>=75?'Excellent':s>=50?'Good':s>=25?'Fair':'Poor';

function DL(l:number|null,f:number|null){
  if(l!==null){if(l<.3)return'Very Shallow';if(l<.9)return'Shallow (1–3ft)';if(l<2.4)return'Moderate (3–8ft)';if(l<6)return'Deep (8–20ft)';return'Very Deep';}
  if(f!==null){if(f<50)return'Very Low Flow';if(f<300)return'Low Flow';if(f<1000)return'Moderate Flow';if(f<5000)return'High Flow';return'Flood Stage';}
  return'No depth data';
}
function DC(l:number|null,f:number|null){
  if(l!==null){if(l<.3)return'#f97316';if(l<.9)return'#eab308';if(l<2.4)return'#22c55e';if(l<6)return'#0891b2';return'#6366f1';}
  if(f!==null){if(f<50)return'#f97316';if(f<1000)return'#22c55e';return'#ef4444';}
  return'#6b7280';
}

function Bar({label,value}:{label:string;value:number}){
  const c=SC(value);
  return(
    <div style={{marginBottom:'4px'}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#9ca3af',marginBottom:'2px'}}><span>{label}</span><span style={{color:c}}>{value}</span></div>
      <div style={{background:'#1f2937',borderRadius:'4px',height:'5px'}}><div style={{width:`${value}%`,background:c,height:'100%',borderRadius:'4px',transition:'width .4s'}}/></div>
    </div>
  );
}

function Row({icon,label,value,unit,hi}:{icon:string;label:string;value:string|number|null;unit?:string;hi?:string}){
  if(value===null||value===undefined)return null;
  return(
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid #1f2937'}}>
      <span style={{fontSize:'11px',color:'#9ca3af'}}>{icon} {label}</span>
      <span style={{fontSize:'12px',fontWeight:'600',color:hi??'#f9fafb'}}>{value}{unit?` ${unit}`:''}</span>
    </div>
  );
}

function Depth({l,f}:{l:number|null;f:number|null}){
  const pct=l!==null?Math.min((l/10)*100,100):f!==null?Math.min((f/10000)*100,100):0;
  const c=DC(l,f);
  return(
    <div style={{background:'#0f172a',border:`1px solid ${c}`,borderRadius:'8px',padding:'10px',marginBottom:'10px'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
        <span style={{fontSize:'11px',color:'#9ca3af'}}>📏 Depth / Water Level</span>
        <span style={{fontSize:'11px',fontWeight:'bold',color:c}}>{DL(l,f)}</span>
      </div>
      <div style={{position:'relative',background:'#1e3a5f',borderRadius:'6px',height:'18px',overflow:'hidden'}}>
        <div style={{width:`${pct}%`,background:`linear-gradient(90deg,#0369a1,${c})`,height:'100%',borderRadius:'6px',transition:'width .5s'}}/>
        <span style={{position:'absolute',right:'6px',top:'50%',transform:'translateY(-50%)',fontSize:'10px',color:'white',fontWeight:'bold'}}>
          {l!==null?`${l.toFixed(2)}m`:f!==null?`${f.toFixed(0)} cfs`:'N/A'}
        </span>
      </div>
    </div>
  );
}

export default function FishingMap({spots}:{spots:Spot[]}){
  const [conditions,setConditions]=useState<Record<string,Cond>>({});
  const [loading,setLoading]=useState<Record<string,boolean>>({});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [tabs,setTabs]=useState<Record<string,Tab>>({});
  const [depthOn,setDepthOn]=useState(false);
  const [temperatureOn,setTemperatureOn]=useState(false);
  const [waypointsOn,setWaypointsOn]=useState(true);

  const temperaturePoints = useMemo(
    () =>
      spots.map((spot) => ({
        lat: spot.lat,
        lng: spot.lng,
        name: spot.name,
        temperature: conditions[spot.id]?.water_temp_c ?? null,
      })),
    [spots, conditions]
  );

  const rankedSpots = spots
    .filter((spot) => conditions[spot.id])
    .map((spot) => ({ spot, score: conditions[spot.id].fishing_score }))
    .sort((a, b) => b.score - a.score);

  const load=async(id:string)=>{
    if(conditions[id]||loading[id])return;
    setLoading(p=>({...p,[id]:true}));
    try{
      const res=await fetch(`/api/spots/${id}/conditions`);
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const data:Cond=await res.json();
      setConditions(p=>({...p,[id]:data}));
      setTabs(p=>({...p,[id]:'score'}));
    }catch(e){setErrors(p=>({...p,[id]:e instanceof Error?e.message:'Failed'}));}
    finally{setLoading(p=>({...p,[id]:false}));}
  };

  const retry=(id:string)=>{
    setErrors(p=>({...p,[id]:''}));
    setConditions(p=>{const n={...p};delete n[id];return n;});
    load(id);
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    spots.forEach((spot) => { load(spot.id); });
  }, [spots]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return(
    <div style={{position:'relative',height:'100%'}}>
      {/* Layer toggles */}
      <div style={{position:'absolute',top:'10px',right:'10px',zIndex:1000,display:'flex',flexDirection:'column',gap:'4px'}}>
        {[
          ['📏 Depth',depthOn,()=>setDepthOn(p=>!p)],
          ['🌡 Water temp',temperatureOn,()=>setTemperatureOn(p=>!p)],
          ['📍 Waypoints',waypointsOn,()=>setWaypointsOn(p=>!p)],
        ].map(([label,active,toggle])=>(
          <button key={label as string} onClick={toggle as ()=>void}
            style={{background:(active as boolean)?'#0369a1':'rgba(15,23,42,0.8)',color:'white',border:'1px solid #334155',padding:'4px 10px',borderRadius:'20px',fontSize:'10px',cursor:'pointer',fontWeight:'bold',backdropFilter:'blur(4px)'}}>
            {label as string}
          </button>
        ))}
      </div>

      <MapContainer center={[35.5,-97.5]} zoom={7} style={{height:'100%',width:'100%'}}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        <DepthOverlay enabled={depthOn}/>
        <WaterTempOverlay points={temperaturePoints} enabled={temperatureOn}/>
        {waypointsOn && <WaypointMarkers/>}

        {spots.map(spot=>{
          const c=conditions[spot.id];
          const tab=tabs[spot.id]??'score';
          const color=c?SC(c.fishing_score):'#6b7280';
          const icon=L.divIcon({
            className:'',
            html:`<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:white">${c?c.fishing_score:'?'}</div>`,
            iconSize:[28,28],iconAnchor:[14,14],
          });

          const TB=(t:Tab,lbl:string)=>(
            <button key={t} onClick={()=>setTabs(p=>({...p,[spot.id]:t}))}
              style={{flex:1,padding:'4px 1px',fontSize:'9px',fontWeight:tab===t?'bold':'normal',
                background:tab===t?'#0891b2':'#1f2937',color:'white',border:'none',cursor:'pointer',borderRadius:'4px'}}>
              {lbl}
            </button>
          );

          return(
            <Marker key={spot.id} position={[spot.lat,spot.lng]} icon={icon} eventHandlers={{click:()=>load(spot.id)}}>
              <Popup maxWidth={360} minWidth={320}>
                <div style={{fontFamily:'system-ui,sans-serif',fontSize:'13px',color:'#f9fafb',background:'#111827',margin:'-10px -15px',padding:'12px',borderRadius:'8px'}}>

                  {/* Header */}
                  <div style={{marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      {rankedSpots.slice(0,3).findIndex(({spot:r})=>r.id===spot.id)>=0&&(
                        <span style={{display:'inline-block',color:'#22c55e',fontSize:'9px',fontWeight:'bold',marginBottom:'2px'}}>OPTIMAL NOW · AI RANK #{rankedSpots.findIndex(({spot:r})=>r.id===spot.id)+1}</span>
                      )}
                      <strong style={{fontSize:'14px',color:'#22d3ee',display:'block'}}>{spot.name}</strong>
                      <p style={{color:'#6b7280',fontSize:'10px',margin:'2px 0 0'}}>{spot.water_type} · {spot.spot_type}</p>
                    </div>
                    {c&&<div style={{textAlign:'right'}}>
                      <div style={{fontSize:'11px',color:'#475569'}}>📍 {spot.lat.toFixed(3)}, {spot.lng.toFixed(3)}</div>
                    </div>}
                  </div>

                  {loading[spot.id]&&<p style={{color:'#3b82f6',textAlign:'center',padding:'16px 0'}}>⏳ Fetching live conditions...</p>}
                  {errors[spot.id]&&!loading[spot.id]&&(
                    <div style={{textAlign:'center',padding:'8px 0'}}>
                      <p style={{color:'#ef4444',fontSize:'11px',marginBottom:'6px'}}>⚠ {errors[spot.id]}</p>
                      <button onClick={()=>retry(spot.id)} style={{background:'#7f1d1d',color:'white',border:'none',padding:'5px 12px',borderRadius:'5px',cursor:'pointer',fontSize:'11px'}}>Retry</button>
                    </div>
                  )}
                  {!c&&!loading[spot.id]&&!errors[spot.id]&&(
                    <button onClick={()=>load(spot.id)} style={{width:'100%',background:'#0369a1',color:'white',border:'none',padding:'8px',borderRadius:'6px',cursor:'pointer',fontSize:'12px',fontWeight:'bold'}}>
                      🌊 Load Live Conditions
                    </button>
                  )}

                  {c&&(
                    <>
                      {/* Score hero */}
                      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px',background:'#0f172a',borderRadius:'8px',padding:'8px'}}>
                        <div style={{textAlign:'center',minWidth:'52px'}}>
                          <div style={{fontSize:'28px',fontWeight:'bold',color:SC(c.fishing_score),lineHeight:1}}>{c.fishing_score}</div>
                          <div style={{fontSize:'9px',color:SC(c.fishing_score),fontWeight:'bold'}}>{SL(c.fishing_score)}</div>
                        </div>
                        <div style={{flex:1}}>
                          {c.score_breakdown?.components&&Object.entries(c.score_breakdown.components).slice(0,3).map(([k,v])=>(
                            <Bar key={k} label={k.charAt(0).toUpperCase()+k.slice(1)} value={v}/>
                          ))}
                        </div>
                      </div>

                      {/* Tabs */}
                      <div style={{display:'flex',gap:'2px',marginBottom:'8px'}}>
                        {TB('score','📊')}{TB('water','💧')}{TB('atmosphere','🌤')}
                        {spot.water_type!=='freshwater'&&TB('marine','🌊')}
                        {TB('bite','🌙')}{TB('forecast','📅')}
                        {TB('ai','AI')}{TB('identify','ID')}{TB('log','🎣')}
                      </div>

                      {tab==='score'&&(
                        <div>
                          {c.score_breakdown?.components&&Object.entries(c.score_breakdown.components).map(([k,v])=><Bar key={k} label={k.charAt(0).toUpperCase()+k.slice(1)} value={v}/>)}
                          <div style={{marginTop:'8px'}}>
                            {c.score_breakdown?.recommendations?.map((r,i)=><p key={i} style={{color:'#4ade80',fontSize:'10px',margin:'2px 0'}}>✓ {r}</p>)}
                            {c.score_breakdown?.warnings?.map((w,i)=><p key={i} style={{color:'#f87171',fontSize:'10px',margin:'2px 0'}}>⚠ {w}</p>)}
                          </div>
                        </div>
                      )}
                      {tab==='water'&&(
                        <div>
                          <Depth l={c.water_level_m} f={c.flow_rate_cfs}/>
                          <Row icon="🌡" label="Water Temp"       value={c.water_temp_c}         unit="°C" hi={c.water_temp_c!==null&&c.water_temp_c>=15&&c.water_temp_c<=25?'#4ade80':'#f87171'}/>
                          <Row icon="💨" label="Dissolved Oxygen" value={c.dissolved_oxygen_mgl} unit="mg/L" hi={c.dissolved_oxygen_mgl!==null&&c.dissolved_oxygen_mgl>=7?'#4ade80':'#f87171'}/>
                          <Row icon="📏" label="Water Level"      value={c.water_level_m!==null?c.water_level_m.toFixed(2):null} unit="m"/>
                          <Row icon="🌊" label="Flow Rate"        value={c.flow_rate_cfs!==null?c.flow_rate_cfs.toFixed(0):null} unit="cfs"/>
                          <Row icon="🧪" label="pH"               value={c.ph} hi={c.ph!==null&&c.ph>=6.5&&c.ph<=8.5?'#4ade80':'#eab308'}/>
                          <Row icon="🌫" label="Turbidity"        value={c.turbidity_ntu} unit="NTU"/>
                          <Row icon="↕"  label="Tide Height"      value={c.tide_height_m!==null?c.tide_height_m.toFixed(2):null} unit="m"/>
                          <Row icon="🌊" label="Tide State"       value={c.tide_type}/>
                        </div>
                      )}
                      {tab==='atmosphere'&&(
                        <div>
                          <Row icon="🌡" label="Air Temp"   value={c.air_temp_c}   unit="°C"/>
                          <Row icon="🔵" label="Pressure"   value={c.pressure_hpa} unit="hPa" hi={c.pressure_hpa!==null&&c.pressure_hpa>=1010?'#4ade80':'#f87171'}/>
                          <Row icon="💧" label="Humidity"   value={c.humidity_pct} unit="%"/>
                          <Row icon="💨" label="Wind Speed" value={c.wind_speed_ms!==null?c.wind_speed_ms.toFixed(1):null} unit="m/s" hi={c.wind_speed_ms!==null&&c.wind_speed_ms<=6?'#4ade80':c.wind_speed_ms!==null&&c.wind_speed_ms<=10?'#eab308':'#f87171'}/>
                          <Row icon="🧭" label="Wind Dir"   value={c.wind_dir_deg} unit="°"/>
                        </div>
                      )}
                      {tab==='marine'&&(
                        <div>
                          <Row icon="🌊" label="Wave Height"     value={c.wave_height_m!==null?c.wave_height_m.toFixed(2):null} unit="m" hi={c.wave_height_m!==null&&c.wave_height_m<=1?'#4ade80':'#f87171'}/>
                          <Row icon="⏱"  label="Wave Period"     value={c.wave_period_s!==null?c.wave_period_s.toFixed(1):null} unit="s"/>
                          <Row icon="🧭" label="Swell Direction" value={c.swell_direction_deg} unit="°"/>
                          <Row icon="↕"  label="Tide Height"     value={c.tide_height_m!==null?c.tide_height_m.toFixed(2):null} unit="m"/>
                          <Row icon="🌊" label="Tide State"      value={c.tide_type}/>
                        </div>
                      )}
                      {tab==='bite'&&(
                        <BiteTimePanel lat={spot.lat} lng={spot.lng} conditions={{
                          water_temp_c:c.water_temp_c, pressure_hpa:c.pressure_hpa,
                          wind_speed_ms:c.wind_speed_ms, dissolved_oxygen_mgl:c.dissolved_oxygen_mgl,
                          is_daytime: new Date().getHours()>6&&new Date().getHours()<20,
                        }}/>
                      )}
                      {tab==='forecast'&&(<SevenDayForecast lat={spot.lat} lng={spot.lng}/>)}
                      {tab==='log'&&(<CatchLogger spotId={spot.id} spotName={spot.name} lat={spot.lat} lng={spot.lng}/>)}
                      {tab==='ai'&&(<FishBot spot={spot} conditions={c}/>)}
                      {tab==='identify'&&(<FishIdentifier/>)}

                      {/* Footer */}
                      <div style={{marginTop:'8px',paddingTop:'6px',borderTop:'1px solid #1f2937'}}>
                        <p style={{color:'#4b5563',fontSize:'9px',margin:0}}>Sources: {c.data_sources?.join(' · ')}</p>
                        <p style={{color:'#374151',fontSize:'9px',margin:'1px 0 0'}}>
                          {c.cached?'📦 Cached · ':'🔴 Live · '}{c.captured_at?new Date(c.captured_at).toLocaleTimeString():''}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
