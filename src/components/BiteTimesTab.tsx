'use client';

const HOURS = Array.from({length:24},(_,i)=>i);
function solunar(hour:number,day:number):number{const moon=((day*0.0336)%1)*Math.PI*2;const major=Math.cos(hour/24*Math.PI*2-moon);const minor=Math.cos(hour/12*Math.PI*2-moon);return Math.max(0,major*0.6+minor*0.4);}
function fmt(h:number){const ampm=h>=12?'PM':'AM';const hr=h%12||12;return `${hr}${ampm}`;}

export default function BiteTimesTab(){
  const now=new Date(),day=now.getDate(),curHour=now.getHours();
  const scores=HOURS.map(h=>({hour:h,score:solunar(h,day)}));
  const max=Math.max(...scores.map(s=>s.score));
  const normalized=scores.map(s=>({...s,pct:s.score/max}));
  const topPeriods=[...normalized].sort((a,b)=>b.pct-a.pct).slice(0,4);
  const major=topPeriods.slice(0,2),minor=topPeriods.slice(2,4);
  const moonPhase=(day%30)/30;
  const moonEmoji=moonPhase<0.1?'🌑':moonPhase<0.25?'🌒':moonPhase<0.4?'🌓':moonPhase<0.6?'🌔':moonPhase<0.75?'🌕':moonPhase<0.85?'🌖':moonPhase<0.95?'🌗':'🌘';
  const barColor=(pct:number)=>pct>0.85?'#22c55e':pct>0.6?'#0ea5e9':pct>0.35?'#eab308':'#334155';

  return(
    <div style={{height:'100%',overflowY:'auto',background:'#060d1a',padding:'16px'}}>
      <div style={{fontSize:'14px',fontWeight:'bold',color:'#22d3ee',marginBottom:'4px'}}>Bite Times</div>
      <div style={{fontSize:'10px',color:'#475569',marginBottom:'16px'}}>Solunar forecast for today</div>
      <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'12px',padding:'14px',marginBottom:'12px',display:'flex',alignItems:'center',gap:'16px'}}>
        <div style={{textAlign:'center'}}><div style={{fontSize:'36px'}}>{moonEmoji}</div><div style={{fontSize:'9px',color:'#475569',marginTop:'2px'}}>Moon Phase</div></div>
        <div style={{flex:1}}>
          <div style={{fontSize:'12px',color:'#e2e8f0',fontWeight:'bold',marginBottom:'6px'}}>Current Activity</div>
          <div style={{background:'#0f172a',borderRadius:'6px',height:'8px',marginBottom:'4px'}}><div style={{background:'linear-gradient(90deg,#0ea5e9,#22c55e)',height:'100%',borderRadius:'6px',width:`${Math.round(normalized[curHour].pct*100)}%`}}/></div>
          <div style={{fontSize:'10px',color:'#64748b'}}>Activity: <span style={{color:'#22d3ee',fontWeight:'bold'}}>{Math.round(normalized[curHour].pct*100)}%</span></div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}>
        <div style={{background:'#0a0f1e',border:'1px solid #22c55e33',borderRadius:'10px',padding:'12px'}}>
          <div style={{fontSize:'9px',color:'#22c55e',fontWeight:'bold',marginBottom:'8px'}}>MAJOR PERIODS</div>
          {major.map(p=><div key={p.hour} style={{fontSize:'12px',color:'#e2e8f0',fontWeight:'bold',marginBottom:'4px'}}>🟢 {fmt(p.hour)} - {fmt(p.hour+2)}</div>)}
        </div>
        <div style={{background:'#0a0f1e',border:'1px solid #0ea5e933',borderRadius:'10px',padding:'12px'}}>
          <div style={{fontSize:'9px',color:'#0ea5e9',fontWeight:'bold',marginBottom:'8px'}}>MINOR PERIODS</div>
          {minor.map(p=><div key={p.hour} style={{fontSize:'12px',color:'#e2e8f0',marginBottom:'4px'}}>🔵 {fmt(p.hour)} - {fmt(p.hour+1)}</div>)}
        </div>
      </div>
      <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'12px',padding:'14px',marginBottom:'12px'}}>
        <div style={{fontSize:'10px',color:'#475569',fontWeight:'bold',marginBottom:'10px'}}>24-HOUR ACTIVITY</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:'2px',height:'60px'}}>
          {normalized.map(({hour,pct})=>(
            <div key={hour} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
              <div style={{width:'100%',background:barColor(pct),borderRadius:'2px 2px 0 0',height:`${Math.round(pct*54)+4}px`,border:hour===curHour?'1px solid white':'none',boxSizing:'border-box',opacity:hour<curHour?0.4:1}}/>
              {hour%6===0&&<div style={{fontSize:'6px',color:'#334155'}}>{fmt(hour)}</div>}
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:'10px',marginTop:'8px',flexWrap:'wrap'}}>
          {[['#22c55e','Excellent'],['#0ea5e9','Good'],['#eab308','Fair'],['#334155','Slow']].map(([col,label])=>(
            <div key={label} style={{display:'flex',alignItems:'center',gap:'4px'}}><div style={{width:'8px',height:'8px',borderRadius:'2px',background:col}}/><span style={{fontSize:'8px',color:'#475569'}}>{label}</span></div>
          ))}
        </div>
      </div>
      <div style={{background:'linear-gradient(135deg,#0c1e3a,#0a0f1e)',border:'1px solid #1e4080',borderRadius:'12px',padding:'14px'}}>
        <div style={{fontSize:'10px',color:'#0ea5e9',fontWeight:'bold',marginBottom:'8px'}}>SOLUNAR TIPS</div>
        {['Fish 30 min before/after each major period for best results.','Full and new moon phases produce the strongest feeding activity.','Barometric pressure drops trigger feeding - check weather tab.'].map((t,i)=>(
          <div key={i} style={{fontSize:'11px',color:'#94a3b8',paddingBottom:'6px',lineHeight:1.5}}>💡 {t}</div>
        ))}
      </div>
    </div>
  );
}
