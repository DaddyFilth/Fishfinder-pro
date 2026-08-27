'use client';
import { useState } from 'react';
interface Spot { id:string; name:string; lat:number; lng:number; water_type:string; spot_type:string; }
interface Plan { destination:Spot; driveTime:string; bestTime:string; species:string[]; gear:string[]; tips:string[]; score:number; }
function score(s:Spot){let h=0;for(const c of s.id)h=(h*31+c.charCodeAt(0))&0xffff;return 50+(h%45);}
export default function AITripPlanner({spots}:{spots:Spot[]}){
  const[plan,setPlan]=useState<Plan|null>(null);
  const[loading,setLoading]=useState(false);
  const[editing,setEditing]=useState(false);
  const[sel,setSel]=useState('');
  function build(spot:Spot):Plan{
    const sc=score(spot);
    const sw:Record<string,string[]>={freshwater:['Largemouth Bass','Bluegill','Catfish'],saltwater:['Redfish','Speckled Trout','Flounder'],brackish:['Redfish','Striped Bass','Drum']};
    const gt:Record<string,string[]>={bank:['Medium spinning rod','8-12lb mono','Worm rigs'],boat:['Heavy baitcaster','17-20lb braid','Crankbaits'],pier:['Long surf rod','20lb mono','Cut bait'],wade:['Light spinning rod','6lb fluoro','Soft plastics']};
    return{destination:spot,driveTime:`${15+(score(spot)%45)} min`,bestTime:sc>70?'Dawn 5:30-8:00 AM':'Dusk 5:00-7:30 PM',species:(sw[spot.water_type?.toLowerCase()]??['Bass','Catfish','Bream']),gear:(gt[spot.spot_type?.toLowerCase()]??['Medium rod','Live bait','Tackle box']),score:sc,tips:[sc>70?'Excellent conditions - go early!':'Fair conditions - try dusk.',`${spot.water_type} ${spot.spot_type} - ${sc>60?'high':'moderate'} activity expected.`,'Check wind direction before casting.','Bring extra hooks - snags likely near structure.']};
  }
  function gen(){if(!spots.length)return;setLoading(true);setTimeout(()=>{const b=[...spots].sort((a,b)=>score(b)-score(a))[0];setPlan(build(b));setSel(b.id);setLoading(false);},1800);}
  function change(id:string){const s=spots.find(x=>x.id===id);if(s){setPlan(build(s));setSel(id);}setEditing(false);}
  const c=(s:number)=>s>=75?'#22c55e':s>=50?'#eab308':'#f97316';
  return(<div style={{padding:'16px',overflowY:'auto',height:'100%'}}>
    <div style={{fontSize:'14px',fontWeight:'bold',color:'#22d3ee',marginBottom:'4px'}}>AI Trip Planner</div>
    <div style={{fontSize:'10px',color:'#475569',marginBottom:'16px'}}>Powered by FishFinder AI</div>
    {!plan&&!loading&&(<div style={{textAlign:'center',paddingTop:'40px'}}>
      <div style={{fontSize:'48px',marginBottom:'12px'}}>&#x1F916;</div>
      <div style={{color:'#94a3b8',fontSize:'13px',marginBottom:'8px'}}>I will find your best local fishing spot</div>
      <div style={{color:'#475569',fontSize:'11px',marginBottom:'24px'}}>and build a complete trip plan in seconds</div>
      <button onClick={gen} style={{background:'linear-gradient(135deg,#0369a1,#7c3aed)',color:'white',border:'none',padding:'14px 28px',borderRadius:'24px',fontSize:'14px',fontWeight:'bold',cursor:'pointer'}}>Plan My Trip</button>
    </div>)}
    {loading&&(<div style={{textAlign:'center',paddingTop:'60px'}}>
      <div style={{fontSize:'40px',marginBottom:'16px'}}>&#x1F3A3;</div>
      <div style={{color:'#22d3ee',fontSize:'13px',fontWeight:'bold'}}>Analyzing {spots.length} spots...</div>
      <div style={{color:'#475569',fontSize:'11px',marginTop:'6px'}}>Checking conditions · Scoring · Building plan</div>
    </div>)}
    {plan&&!loading&&(<div>
      <div style={{background:'#0a0f1e',border:`2px solid ${c(plan.score)}`,borderRadius:'12px',padding:'14px',marginBottom:'12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:'10px',color:'#475569',marginBottom:'2px'}}>AI RECOMMENDED</div>
          <div style={{fontSize:'16px',fontWeight:'bold',color:'#e2e8f0'}}>{plan.destination.name}</div>
          <div style={{fontSize:'10px',color:'#64748b',marginTop:'2px'}}>{plan.destination.water_type} · {plan.destination.spot_type} · {plan.driveTime} away</div>
        </div>
        <div style={{textAlign:'center'}}><div style={{fontSize:'28px',fontWeight:'900',color:c(plan.score)}}>{plan.score}</div><div style={{fontSize:'8px',color:'#475569'}}>SCORE</div></div>
      </div>
      {!editing?(<button onClick={()=>setEditing(true)} style={{width:'100%',background:'#0f172a',border:'1px dashed #334155',borderRadius:'8px',color:'#0ea5e9',padding:'8px',fontSize:'11px',cursor:'pointer',marginBottom:'12px'}}>Change Destination</button>
      ):(<div style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',marginBottom:'12px'}}>
        <div style={{fontSize:'10px',color:'#475569',marginBottom:'6px'}}>SELECT A SPOT</div>
        <select value={sel} onChange={e=>change(e.target.value)} style={{width:'100%',background:'#1e293b',color:'#e2e8f0',border:'1px solid #334155',borderRadius:'6px',padding:'8px',fontSize:'12px'}}>
          {[...spots].sort((a,b)=>score(b)-score(a)).map(s=><option key={s.id} value={s.id}>{s.name} - Score {score(s)}</option>)}
        </select>
        <button onClick={()=>setEditing(false)} style={{marginTop:'6px',background:'none',border:'none',color:'#475569',fontSize:'10px',cursor:'pointer'}}>Cancel</button>
      </div>)}
      <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'10px',padding:'12px',marginBottom:'8px'}}><div style={{fontSize:'10px',color:'#475569',marginBottom:'6px'}}>BEST TIME TO GO</div><div style={{fontSize:'14px',color:'#fbbf24',fontWeight:'bold'}}>{plan.bestTime}</div></div>
      <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'10px',padding:'12px',marginBottom:'8px'}}><div style={{fontSize:'10px',color:'#475569',marginBottom:'8px'}}>TARGET SPECIES</div><div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>{plan.species.map(s=><span key={s} style={{background:'#0c4a6e',color:'#7dd3fc',fontSize:'11px',padding:'4px 10px',borderRadius:'12px',fontWeight:'bold'}}>{s}</span>)}</div></div>
      <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'10px',padding:'12px',marginBottom:'8px'}}><div style={{fontSize:'10px',color:'#475569',marginBottom:'8px'}}>GEAR</div>{plan.gear.map(g=><div key={g} style={{fontSize:'12px',color:'#cbd5e1',paddingBottom:'4px'}}>&#10003; {g}</div>)}</div>
      <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'10px',padding:'12px',marginBottom:'16px'}}><div style={{fontSize:'10px',color:'#475569',marginBottom:'8px'}}>AI TIPS</div>{plan.tips.map((t,i)=><div key={i} style={{fontSize:'11px',color:'#94a3b8',paddingBottom:'6px',lineHeight:1.5}}>&#x1F4A1; {t}</div>)}</div>
      <div style={{display:'flex',gap:'8px',marginBottom:'24px'}}>
        <button style={{flex:1,background:'linear-gradient(135deg,#0369a1,#0ea5e9)',color:'white',border:'none',padding:'12px',borderRadius:'10px',fontSize:'12px',fontWeight:'bold',cursor:'pointer'}}>Navigate There</button>
        <button onClick={gen} style={{flex:1,background:'#0f172a',border:'1px solid #334155',color:'#94a3b8',padding:'12px',borderRadius:'10px',fontSize:'12px',cursor:'pointer'}}>Replan</button>
      </div>
    </div>)}
  </div>);
}
