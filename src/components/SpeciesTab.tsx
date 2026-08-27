'use client';
import { useState } from 'react';

const SPECIES = [
  { id:'lmb', name:'Largemouth Bass', sci:'Micropterus salmoides', emoji:'🐟', type:'Freshwater', difficulty:'Medium', record:'22 lb 4 oz', season:['Spring','Summer','Fall'], bestBait:['Plastic worms','Crankbaits','Spinnerbaits','Frogs'], bestTime:'Dawn & Dusk', depth:'2-15 ft', habitat:'Weeds, structure, docks', tips:'Target lily pads in summer. Topwater lures at dawn.', activity:[4,5,9,8,7,6,5,6,7,8,5,3] },
  { id:'cat', name:'Channel Catfish',  sci:'Ictalurus punctatus',   emoji:'🐠', type:'Freshwater', difficulty:'Easy',   record:'58 lb',      season:['Spring','Summer','Fall'], bestBait:['Chicken liver','Stink bait','Nightcrawlers','Cut shad'], bestTime:'Night', depth:'10-30 ft', habitat:'Deep holes, river bends', tips:'Fish the bottom at night near structure. Strong smell baits work best.', activity:[3,3,5,6,8,9,9,8,7,5,4,3] },
  { id:'blu', name:'Bluegill',         sci:'Lepomis macrochirus',    emoji:'🐡', type:'Freshwater', difficulty:'Easy',   record:'4 lb 12 oz', season:['Spring','Summer'],        bestBait:['Crickets','Worms','Small jigs','Bread'], bestTime:'Midday', depth:'1-8 ft', habitat:'Shallow weeds, piers', tips:'Use tiny hooks. Great for kids and beginners.', activity:[2,2,4,6,9,9,9,8,6,4,2,2] },
  { id:'rdf', name:'Redfish',          sci:'Sciaenops ocellatus',    emoji:'🦈', type:'Saltwater',  difficulty:'Medium', record:'94 lb 2 oz', season:['Fall','Winter','Spring'], bestBait:['Live shrimp','Crab','Gold spoons','Soft plastics'], bestTime:'Incoming tide', depth:'1-6 ft', habitat:'Grass flats, oyster bars', tips:'Look for tailing reds in shallow flats. Spot-and-stalk.', activity:[7,6,7,8,7,6,5,5,8,9,8,7] },
  { id:'spt', name:'Speckled Trout',   sci:'Cynoscion nebulosus',    emoji:'🐟', type:'Saltwater',  difficulty:'Medium', record:'17 lb 7 oz', season:['Fall','Winter'],          bestBait:['Mirrolure','Live shrimp','Soft plastics'], bestTime:'Early morning', depth:'2-10 ft', habitat:'Grass beds, channels', tips:'Work topwaters over grass in low light. Vary retrieve speed.', activity:[6,5,6,7,7,6,5,5,7,9,9,7] },
  { id:'crp', name:'Crappie',          sci:'Pomoxis nigromaculatus', emoji:'🐠', type:'Freshwater', difficulty:'Easy',   record:'5 lb 3 oz',  season:['Spring','Winter'],        bestBait:['Minnows','Jigs','Small spinners'], bestTime:'Dawn', depth:'5-15 ft', habitat:'Brush piles, bridges', tips:'Vertical jig near structure. Spider rig for covering water.', activity:[5,4,7,9,6,4,3,3,5,6,5,5] },
  { id:'flo', name:'Flounder',         sci:'Paralichthys lethostigma',emoji:'🦈', type:'Saltwater', difficulty:'Hard',   record:'22 lb 7 oz', season:['Summer','Fall'],          bestBait:['Live finger mullet','Gulp shrimp','Jigs'], bestTime:'Incoming tide', depth:'3-20 ft', habitat:'Sandy bottoms, jetties', tips:'Bounce bait slowly on bottom. Look for ambush points.', activity:[2,2,3,4,6,7,8,9,8,7,4,2] },
  { id:'str', name:'Striped Bass',     sci:'Morone saxatilis',       emoji:'🐟', type:'Both',       difficulty:'Hard',   record:'81 lb 14 oz',season:['Spring','Fall'],           bestBait:['Bunker','Eels','Swimbaits','Bucktails'], bestTime:'Dawn', depth:'5-40 ft', habitat:'Structure, rips, channels', tips:'Follow baitfish schools. Cast to breaking fish.', activity:[6,5,7,9,7,5,4,4,6,9,8,6] },
];

const MONTHS = ['J','F','M','A','M','J','J','A','S','O','N','D'];
const TYPES = ['All','Freshwater','Saltwater','Both'];

export default function SpeciesTab() {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<typeof SPECIES[0]|null>(null);

  const filtered = SPECIES.filter(s =>
    (filter==='All'||s.type===filter||s.type==='Both') &&
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if(selected) return (
    <div style={{height:'100%',overflowY:'auto',background:'#060d1a'}}>
      {/* Header */}
      <div style={{background:'linear-gradient(180deg,#0c1e3a,#060d1a)',padding:'16px',borderBottom:'1px solid #1e293b'}}>
        <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',color:'#0ea5e9',fontSize:'12px',cursor:'pointer',marginBottom:'8px',display:'flex',alignItems:'center',gap:'4px'}}>
          ← Back to Species
        </button>
        <div style={{fontSize:'40px',marginBottom:'6px'}}>{selected.emoji}</div>
        <div style={{fontSize:'18px',fontWeight:'bold',color:'#e2e8f0'}}>{selected.name}</div>
        <div style={{fontSize:'11px',color:'#475569',fontStyle:'italic',marginBottom:'8px'}}>{selected.sci}</div>
        <div style={{display:'flex',gap:'6px'}}>
          <span style={{background:'#0c4a6e',color:'#7dd3fc',fontSize:'10px',padding:'3px 8px',borderRadius:'10px'}}>{selected.type}</span>
          <span style={{background: selected.difficulty==='Easy'?'#14532d':selected.difficulty==='Medium'?'#713f12':'#7f1d1d', color:selected.difficulty==='Easy'?'#4ade80':selected.difficulty==='Medium'?'#fbbf24':'#f87171', fontSize:'10px',padding:'3px 8px',borderRadius:'10px'}}>{selected.difficulty}</span>
          <span style={{background:'#1e1b4b',color:'#a5b4fc',fontSize:'10px',padding:'3px 8px',borderRadius:'10px'}}>Record: {selected.record}</span>
        </div>
      </div>

      <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
        {/* Activity chart */}
        <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'12px',padding:'14px'}}>
          <div style={{fontSize:'11px',color:'#475569',fontWeight:'bold',marginBottom:'10px'}}>MONTHLY ACTIVITY</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:'4px',height:'50px'}}>
            {selected.activity.map((v,i)=>(
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}>
                <div style={{width:'100%',background:`rgba(14,165,233,${v/10})`,border:`1px solid rgba(14,165,233,${v/8})`,borderRadius:'3px 3px 0 0',height:`${v*5}px`,transition:'height 0.3s'}}/>
                <div style={{fontSize:'7px',color:'#334155'}}>{MONTHS[i]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Best bait */}
        <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'12px',padding:'14px'}}>
          <div style={{fontSize:'11px',color:'#475569',fontWeight:'bold',marginBottom:'10px'}}>BEST BAITS</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
            {selected.bestBait.map(b=><span key={b} style={{background:'#0f2744',border:'1px solid #1e4080',color:'#93c5fd',fontSize:'11px',padding:'5px 10px',borderRadius:'20px'}}>🪱 {b}</span>)}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
          {[
            {label:'BEST TIME', value:selected.bestTime, icon:'⏰'},
            {label:'DEPTH RANGE', value:selected.depth, icon:'🌊'},
            {label:'PEAK SEASON', value:selected.season.join(', '), icon:'📅'},
            {label:'HABITAT', value:selected.habitat, icon:'🌿'},
          ].map(s=>(
            <div key={s.label} style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'10px',padding:'12px'}}>
              <div style={{fontSize:'9px',color:'#475569',marginBottom:'4px'}}>{s.icon} {s.label}</div>
              <div style={{fontSize:'11px',color:'#cbd5e1',lineHeight:1.3}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Pro tips */}
        <div style={{background:'linear-gradient(135deg,#0c1e3a,#0a0f1e)',border:'1px solid #1e4080',borderRadius:'12px',padding:'14px'}}>
          <div style={{fontSize:'11px',color:'#0ea5e9',fontWeight:'bold',marginBottom:'8px'}}>💡 PRO TIP</div>
          <div style={{fontSize:'12px',color:'#94a3b8',lineHeight:1.6}}>{selected.tips}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#060d1a'}}>
      <div style={{padding:'12px 16px',borderBottom:'1px solid #1e293b'}}>
        <div style={{fontSize:'14px',fontWeight:'bold',color:'#22d3ee',marginBottom:'8px'}}>Species Guide</div>
        {/* Search */}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search species..."
          style={{width:'100%',background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'8px 12px',fontSize:'12px',color:'#e2e8f0',marginBottom:'8px',boxSizing:'border-box'}}/>
        {/* Filter pills */}
        <div style={{display:'flex',gap:'6px'}}>
          {TYPES.map(t=><button key={t} onClick={()=>setFilter(t)}
            style={{background:filter===t?'#0ea5e9':'#0f172a',border:`1px solid ${filter===t?'#0ea5e9':'#334155'}`,color:filter===t?'white':'#64748b',padding:'4px 10px',borderRadius:'12px',fontSize:'10px',cursor:'pointer',fontWeight:filter===t?'bold':'normal'}}>
            {t}
          </button>)}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:'8px'}}>
        {filtered.map(s=>(
          <button key={s.id} onClick={()=>setSelected(s)}
            style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'12px',padding:'12px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer',textAlign:'left',width:'100%',transition:'border-color 0.2s'}}>
            <div style={{fontSize:'32px',flexShrink:0}}>{s.emoji}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:'13px',fontWeight:'bold',color:'#e2e8f0',marginBottom:'2px'}}>{s.name}</div>
              <div style={{fontSize:'10px',color:'#475569',fontStyle:'italic',marginBottom:'6px'}}>{s.sci}</div>
              <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                <span style={{background:'#0c4a6e',color:'#7dd3fc',fontSize:'9px',padding:'2px 6px',borderRadius:'8px'}}>{s.type}</span>
                <span style={{background:s.difficulty==='Easy'?'#14532d':s.difficulty==='Medium'?'#713f12':'#7f1d1d',color:s.difficulty==='Easy'?'#4ade80':s.difficulty==='Medium'?'#fbbf24':'#f87171',fontSize:'9px',padding:'2px 6px',borderRadius:'8px'}}>{s.difficulty}</span>
                <span style={{background:'#1e1b4b',color:'#a5b4fc',fontSize:'9px',padding:'2px 6px',borderRadius:'8px'}}>🏆 {s.record}</span>
              </div>
            </div>
            <div style={{color:'#334155',fontSize:'16px'}}>›</div>
          </button>
        ))}
        {filtered.length===0&&<div style={{textAlign:'center',color:'#334155',padding:'40px 0',fontSize:'13px'}}>No species found</div>}
      </div>
    </div>
  );
}
