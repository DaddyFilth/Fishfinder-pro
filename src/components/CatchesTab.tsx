'use client';
import { useState } from 'react';

const SPECIES_LIST = ['Largemouth Bass','Channel Catfish','Bluegill','Redfish','Speckled Trout','Crappie','Flounder','Striped Bass','Carp','Pike','Walleye','Trout'];
interface Catch { id:string; species:string; weight:string; length:string; spot:string; date:string; notes:string; emoji:string; }
const SAMPLE:Catch[] = [
  { id:'1', species:'Largemouth Bass', weight:'4.2', length:'18', spot:'Lake Fork North', date:'2026-08-25', notes:'Topwater frog at dawn', emoji:'🐟' },
  { id:'2', species:'Redfish', weight:'7.8', length:'24', spot:'Galveston Bay Flats', date:'2026-08-22', notes:'Live shrimp on incoming tide', emoji:'🦈' },
  { id:'3', species:'Crappie', weight:'1.1', length:'11', spot:'Toledo Bend Pier', date:'2026-08-20', notes:'Small jig under bridge', emoji:'🐠' },
];
const EMOJI_MAP:Record<string,string> = {'Largemouth Bass':'🐟','Channel Catfish':'🐠','Bluegill':'🐡','Redfish':'🦈','Speckled Trout':'🐟','Crappie':'🐠','Flounder':'🦈','Striped Bass':'🐟','Carp':'🐠','Pike':'🐟','Walleye':'🐟','Trout':'🐟'};

export default function CatchesTab() {
  const [catches, setCatches] = useState<Catch[]>(SAMPLE);
  const [logging, setLogging] = useState(false);
  const [form, setForm] = useState({ species:'Largemouth Bass', weight:'', length:'', spot:'', notes:'' });

  function logCatch() {
    if(!form.weight||!form.spot) return;
    const c:Catch = { id:Date.now().toString(), species:form.species, weight:form.weight, length:form.length, spot:form.spot, date:new Date().toISOString().split('T')[0], notes:form.notes, emoji:EMOJI_MAP[form.species]||'🐟' };
    setCatches(prev=>[c,...prev]);
    setForm({ species:'Largemouth Bass', weight:'', length:'', spot:'', notes:'' });
    setLogging(false);
  }

  const totalWeight = catches.reduce((s,c)=>s+parseFloat(c.weight||'0'),0).toFixed(1);

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#060d1a',position:'relative'}}>
      <div style={{padding:'12px 16px',borderBottom:'1px solid #1e293b'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
          <div style={{fontSize:'14px',fontWeight:'bold',color:'#22d3ee'}}>Catch Log</div>
          <button onClick={()=>setLogging(true)} style={{background:'linear-gradient(135deg,#0369a1,#0ea5e9)',color:'white',border:'none',padding:'6px 14px',borderRadius:'16px',fontSize:'11px',fontWeight:'bold',cursor:'pointer'}}>+ Log Catch</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px'}}>
          {[{label:'CATCHES',value:catches.length},{label:'TOTAL LBS',value:totalWeight},{label:'SPECIES',value:new Set(catches.map(c=>c.species)).size}].map(s=>(
            <div key={s.label} style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'8px',padding:'8px',textAlign:'center'}}>
              <div style={{fontSize:'16px',fontWeight:'bold',color:'#22d3ee'}}>{s.value}</div>
              <div style={{fontSize:'8px',color:'#475569'}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      {logging&&(
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50,display:'flex',alignItems:'flex-end'}}>
          <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'20px 20px 0 0',padding:'20px',width:'100%',boxSizing:'border-box'}}>
            <div style={{fontSize:'14px',fontWeight:'bold',color:'#22d3ee',marginBottom:'16px'}}>Log a Catch</div>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <select value={form.species} onChange={e=>setForm(f=>({...f,species:e.target.value}))} style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',color:'#e2e8f0',fontSize:'13px'}}>
                {SPECIES_LIST.map(s=><option key={s}>{s}</option>)}
              </select>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                <input value={form.weight} onChange={e=>setForm(f=>({...f,weight:e.target.value}))} placeholder="Weight (lbs)" type="number" style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',color:'#e2e8f0',fontSize:'12px'}}/>
                <input value={form.length} onChange={e=>setForm(f=>({...f,length:e.target.value}))} placeholder="Length (in)" type="number" style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',color:'#e2e8f0',fontSize:'12px'}}/>
              </div>
              <input value={form.spot} onChange={e=>setForm(f=>({...f,spot:e.target.value}))} placeholder="Spot name" style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',color:'#e2e8f0',fontSize:'12px'}}/>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes (optional)" style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',color:'#e2e8f0',fontSize:'12px'}}/>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={logCatch} style={{flex:1,background:'linear-gradient(135deg,#0369a1,#0ea5e9)',color:'white',border:'none',padding:'12px',borderRadius:'10px',fontSize:'13px',fontWeight:'bold',cursor:'pointer'}}>Save Catch</button>
                <button onClick={()=>setLogging(false)} style={{flex:1,background:'#0f172a',border:'1px solid #334155',color:'#94a3b8',padding:'12px',borderRadius:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:'8px'}}>
        {catches.map(c=>(
          <div key={c.id} style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'12px',padding:'12px',display:'flex',gap:'12px',alignItems:'center'}}>
            <div style={{fontSize:'32px'}}>{c.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:'13px',fontWeight:'bold',color:'#e2e8f0'}}>{c.species}</div>
              <div style={{fontSize:'10px',color:'#64748b',marginBottom:'4px'}}>{c.spot} · {c.date}</div>
              <div style={{display:'flex',gap:'6px'}}>
                <span style={{background:'#0c4a6e',color:'#7dd3fc',fontSize:'10px',padding:'2px 7px',borderRadius:'8px'}}>{c.weight} lbs</span>
                {c.length&&<span style={{background:'#1e1b4b',color:'#a5b4fc',fontSize:'10px',padding:'2px 7px',borderRadius:'8px'}}>{c.length}"</span>}
              </div>
              {c.notes&&<div style={{fontSize:'10px',color:'#475569',marginTop:'4px',fontStyle:'italic'}}>"{c.notes}"</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
