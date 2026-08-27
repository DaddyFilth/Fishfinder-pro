'use client';
import { useEffect, useState } from 'react';

const HOURS=['6A','7A','8A','9A','10A','11A','12P','1P','2P','3P','4P','5P','6P'];
const TEMPS=[68,69,71,74,77,80,82,83,83,81,79,76,73];
const WINDS=[4,4,5,6,7,8,9,9,8,10,11,9,7];
const RAIN= [0,0,0,0,5,10,15,20,20,30,25,10,5];
const PRESSURE=[1012,1013,1013,1012,1011,1010,1010,1011,1012,1013,1013,1012,1011];
const TIDE=[{time:'4:22 AM',type:'LOW',height:'0.8 ft'},{time:'10:45 AM',type:'HIGH',height:'3.2 ft'},{time:'5:08 PM',type:'LOW',height:'0.6 ft'},{time:'11:31 PM',type:'HIGH',height:'3.4 ft'}];

export default function WeatherTab(){
  const [now,setNow]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t);},[]);
  const idx=Math.min(Math.max(now.getHours()-6,0),12);
  const pressureTrend=PRESSURE[idx]>PRESSURE[Math.max(0,idx-1)]?'Rising':PRESSURE[idx]<PRESSURE[Math.max(0,idx-1)]?'Falling':'Steady';
  const pressureColor=pressureTrend==='Rising'?'#22c55e':pressureTrend==='Falling'?'#f97316':'#94a3b8';

  return(
    <div style={{height:'100%',overflowY:'auto',background:'#060d1a',padding:'16px'}}>
      <div style={{fontSize:'14px',fontWeight:'bold',color:'#22d3ee',marginBottom:'4px'}}>Weather & Tides</div>
      <div style={{fontSize:'10px',color:'#475569',marginBottom:'16px'}}>Local conditions</div>
      <div style={{background:'linear-gradient(135deg,#0c1e3a,#0a1628)',border:'1px solid #1e293b',borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
          <div><div style={{fontSize:'36px',fontWeight:'bold',color:'#e2e8f0'}}>{TEMPS[idx]}°F</div><div style={{fontSize:'11px',color:'#64748b'}}>Partly Cloudy</div></div>
          <div style={{fontSize:'48px'}}>⛅</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px'}}>
          {[{icon:'💨',label:'Wind',value:`${WINDS[idx]}mph SW`},{icon:'💧',label:'Humidity',value:'72%'},{icon:'👁',label:'Visibility',value:'10 mi'}].map(s=>(
            <div key={s.label} style={{background:'rgba(255,255,255,0.04)',borderRadius:'8px',padding:'8px',textAlign:'center'}}>
              <div style={{fontSize:'14px'}}>{s.icon}</div>
              <div style={{fontSize:'10px',fontWeight:'bold',color:'#e2e8f0'}}>{s.value}</div>
              <div style={{fontSize:'8px',color:'#475569'}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'12px',padding:'14px',marginBottom:'12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
          <div style={{fontSize:'10px',color:'#475569',fontWeight:'bold'}}>BAROMETRIC PRESSURE</div>
          <div style={{fontSize:'10px',color:pressureColor,fontWeight:'bold'}}>{pressureTrend==='Rising'?'↑':pressureTrend==='Falling'?'↓':'→'} {pressureTrend}</div>
        </div>
        <div style={{display:'flex',alignItems:'flex-end',gap:'2px',height:'40px',marginBottom:'6px'}}>
          {PRESSURE.map((p,i)=><div key={i} style={{flex:1,background:i===idx?'#0ea5e9':'#1e293b',borderRadius:'2px 2px 0 0',height:`${(p-1005)*8}px`}}/>)}
        </div>
        <div style={{fontSize:'11px',color:'#94a3b8'}}>Current: <span style={{color:'#e2e8f0',fontWeight:'bold'}}>{PRESSURE[idx]} hPa</span> · {pressureTrend==='Falling'?'Feeding likely to increase':'Good conditions'}</div>
      </div>
      <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'12px',padding:'14px',marginBottom:'12px'}}>
        <div style={{fontSize:'10px',color:'#475569',fontWeight:'bold',marginBottom:'10px'}}>TIDES TODAY</div>
        {TIDE.map((t,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:i<TIDE.length-1?'1px solid #0f172a':'none'}}>
            <div style={{fontSize:'16px'}}>{t.type==='HIGH'?'🌊':'〰️'}</div>
            <div style={{flex:1}}><div style={{fontSize:'12px',fontWeight:'bold',color:t.type==='HIGH'?'#0ea5e9':'#64748b'}}>{t.type} TIDE</div><div style={{fontSize:'10px',color:'#475569'}}>{t.time}</div></div>
            <div style={{fontSize:'12px',fontWeight:'bold',color:'#e2e8f0'}}>{t.height}</div>
          </div>
        ))}
        <div style={{fontSize:'10px',color:'#475569',marginTop:'8px'}}>💡 Best fishing 1hr before/after tide changes</div>
      </div>
      <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'12px',padding:'14px'}}>
        <div style={{fontSize:'10px',color:'#475569',fontWeight:'bold',marginBottom:'10px'}}>HOURLY FORECAST</div>
        <div style={{display:'flex',gap:'8px',overflowX:'auto',paddingBottom:'4px'}}>
          {HOURS.map((h,i)=>(
            <div key={h} style={{flexShrink:0,background:i===idx?'rgba(14,165,233,0.15)':'#0f172a',border:`1px solid ${i===idx?'#0ea5e9':'#1e293b'}`,borderRadius:'8px',padding:'8px',textAlign:'center',minWidth:'44px'}}>
              <div style={{fontSize:'9px',color:i===idx?'#0ea5e9':'#475569',marginBottom:'4px'}}>{h}</div>
              <div style={{fontSize:'12px',marginBottom:'4px'}}>{RAIN[i]>20?'🌧':RAIN[i]>5?'🌦':'☀️'}</div>
              <div style={{fontSize:'10px',fontWeight:'bold',color:'#e2e8f0'}}>{TEMPS[i]}°</div>
              <div style={{fontSize:'9px',color:'#334155'}}>{WINDS[i]}mph</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
