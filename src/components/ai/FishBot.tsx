'use client';
import { useState, useRef, useEffect } from 'react';
import { calculateSolunar } from '@/lib/scoring/solunar';

interface Msg { role: 'user' | 'bot'; text: string; ts: string; }
interface Advice { error?: string; go_fishing?: boolean; best_time_today?: string; top_bait?: string; top_technique?: string; target_depth?: string; hotspot_tip?: string; caution?: string; }
interface Props {
  spot: { id: string; name: string; water_type: string; spot_type: string; lat: number; lng: number };
  conditions: object;
}

export default function FishBot({ spot, conditions }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [species, setSpecies] = useState('Largemouth Bass');
  const scrollRef = useRef<HTMLDivElement>(null);
  const solunar = calculateSolunar(new Date(), spot.lat);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }); }, [messages]);

  const loadAdvice = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditions, spot, species, solunar }),
      });
      setAdvice(await res.json());
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(p => [...p, { role: 'user', text: userMsg, ts: new Date().toLocaleTimeString() }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, spot, conditions, solunar, species }),
      });
      const data = await res.json();
      setMessages(p => [...p, { role: 'bot', text: data.reply ?? 'Sorry, try again.', ts: new Date().toLocaleTimeString() }]);
    } catch {
      setMessages(p => [...p, { role: 'bot', text: 'Connection error.', ts: new Date().toLocaleTimeString() }]);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ fontFamily:'system-ui,sans-serif', color:'white' }}>
      <select value={species} onChange={e=>setSpecies(e.target.value)}
        style={{ width:'100%', background:'#1e293b', color:'white', border:'1px solid #334155', borderRadius:'6px', padding:'5px 8px', fontSize:'11px', marginBottom:'8px' }}>
        {['Largemouth Bass','Channel Catfish','Walleye','Rainbow Trout','Crappie','Striped Bass','Redfish/Red Drum','Flounder'].map(s=>(
          <option key={s}>{s}</option>
        ))}
      </select>

      {!advice && (
        <button onClick={loadAdvice} disabled={loading}
          style={{ width:'100%', background:loading?'#1e3a5f':'linear-gradient(135deg,#0369a1,#7c3aed)', color:'white', border:'none', padding:'10px', borderRadius:'8px', fontSize:'13px', fontWeight:'bold', cursor:loading?'default':'pointer', marginBottom:'8px' }}>
          {loading ? 'AI Analyzing...' : 'Get AI Fishing Advice'}
        </button>
      )}

      {advice && !advice.error && (
        <div style={{ background:'#0f172a', borderRadius:'8px', padding:'10px', marginBottom:'8px', border:'1px solid #1e3a5f' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
            <span style={{ fontSize:'10px', color:'#64748b', fontWeight:'bold' }}>AI TRIP ADVISOR</span>
            <span style={{ fontSize:'11px', color:advice.go_fishing?'#4ade80':'#f87171', fontWeight:'bold' }}>
              {advice.go_fishing ? 'GO FISH' : 'SKIP TODAY'}
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginBottom:'6px' }}>
            {[['Best Time', advice.best_time_today],['Top Bait', advice.top_bait],['Technique', advice.top_technique],['Depth', advice.target_depth]].map(([l,v])=>v&&(
              <div key={l} style={{ background:'#1e293b', borderRadius:'5px', padding:'5px' }}>
                <div style={{ fontSize:'8px', color:'#64748b' }}>{l}</div>
                <div style={{ fontSize:'10px', color:'#e2e8f0', lineHeight:1.3 }}>{v}</div>
              </div>
            ))}
          </div>
          {advice.hotspot_tip && <p style={{ fontSize:'10px', color:'#7dd3fc', margin:'0 0 4px', borderLeft:'3px solid #0ea5e9', paddingLeft:'6px' }}>{advice.hotspot_tip}</p>}
          {advice.caution && <p style={{ fontSize:'10px', color:'#fca5a5', margin:0, borderLeft:'3px solid #ef4444', paddingLeft:'6px' }}>{advice.caution}</p>}
          <button onClick={loadAdvice} style={{ width:'100%', background:'#1e293b', color:'#94a3b8', border:'1px solid #334155', padding:'4px', borderRadius:'5px', fontSize:'10px', cursor:'pointer', marginTop:'6px' }}>
            Refresh Advice
          </button>
        </div>
      )}

      <div style={{ fontSize:'10px', color:'#64748b', fontWeight:'bold', marginBottom:'4px' }}>ASK FISHBOT</div>
      <div ref={scrollRef} style={{ background:'#0a0f1e', borderRadius:'8px', padding:'8px', height:'130px', overflowY:'auto', marginBottom:'6px', border:'1px solid #1e293b' }}>
        {messages.length === 0 && <p style={{ color:'#374151', fontSize:'10px', textAlign:'center', marginTop:'40px' }}>Ask anything about fishing this spot...</p>}
        {messages.map((m,i) => (
          <div key={i} style={{ marginBottom:'6px', display:'flex', flexDirection:'column', alignItems:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ background:m.role==='user'?'#0369a1':'#1e293b', color:'white', padding:'5px 8px', borderRadius:'8px', maxWidth:'90%', fontSize:'10px', lineHeight:1.4 }}>
              {m.role==='bot'&&'🤖 '}{m.text}
            </div>
          </div>
        ))}
        {loading && messages[messages.length-1]?.role==='user' && (
          <p style={{ color:'#3b82f6', fontSize:'10px', padding:'4px' }}>🤖 Thinking...</p>
        )}
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:'3px', marginBottom:'5px' }}>
        {['Best bait right now?','What depth?','Conditions improving?','Best technique?'].map(q=>(
          <button key={q} onClick={()=>setInput(q)} style={{ background:'#1e293b', color:'#94a3b8', border:'1px solid #334155', padding:'3px 6px', borderRadius:'10px', fontSize:'9px', cursor:'pointer' }}>{q}</button>
        ))}
      </div>

      <div style={{ display:'flex', gap:'4px' }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
          placeholder="Ask FishBot..." style={{ flex:1, background:'#1e293b', color:'white', border:'1px solid #334155', borderRadius:'6px', padding:'5px 8px', fontSize:'11px' }} />
        <button onClick={send} disabled={loading||!input.trim()} style={{ background:'#0369a1', color:'white', border:'none', padding:'5px 10px', borderRadius:'6px', fontSize:'11px', cursor:'pointer' }}>Send</button>
      </div>
    </div>
  );
}
