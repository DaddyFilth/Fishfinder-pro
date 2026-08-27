'use client';
import { useState, useEffect, useRef } from 'react';

interface Spot { id:string; name:string; lat:number; lng:number; water_type:string; spot_type:string; }

const LAYERS = [
  { id:'spots',   label:'Fishing Spots', icon:'🎣', color:'#0ea5e9' },
  { id:'depth',   label:'Depth',         icon:'🌊', color:'#6366f1' },
  { id:'heat',    label:'Activity Heat', icon:'🔥', color:'#f97316' },
  { id:'weather', label:'Weather',       icon:'💨', color:'#22c55e' },
];

function score(s:Spot){let h=0;for(const c of s.id)h=(h*31+c.charCodeAt(0))&0xffff;return 50+(h%45);}

function depthNoise(x:number,y:number,seed:number):number{
  const s=Math.sin(x*127.1+y*311.7+seed)*43758.5453;
  return s-Math.floor(s);
}

function getDepth(nx:number,ny:number):number{
  let d=depthNoise(nx*2,ny*2,1)*0.5+depthNoise(nx*4,ny*4,2)*0.25+depthNoise(nx*8,ny*8,3)*0.125+depthNoise(nx*16,ny*16,4)*0.0625;
  const channel=Math.max(0,1-Math.abs((nx-ny*0.8-0.1)*8));
  d+=channel*0.4;
  const shore=Math.min(nx,ny,1-nx,1-ny)*4;
  d=d*0.6+(1-Math.exp(-shore*2))*0.4;
  return Math.min(1,Math.max(0,d));
}

function depthColor(d:number):[number,number,number]{
  if(d<0.15) return [180,230,255];
  if(d<0.30) return [100,190,240];
  if(d<0.45) return [40,140,210];
  if(d<0.60) return [20,90,170];
  if(d<0.75) return [10,50,130];
  if(d<0.88) return [5,25,90];
  return [2,10,50];
}

function drawDepthMap(canvas:HTMLCanvasElement){
  const ctx=canvas.getContext('2d');
  if(!ctx) return;
  const W=canvas.width,H=canvas.height;
  const img=ctx.createImageData(W,H);
  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const d=getDepth(x/W,y/H);
      const [r,g,b]=depthColor(d);
      const i=(y*W+x)*4;
      img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  ctx.strokeStyle='rgba(255,255,255,0.07)';
  ctx.lineWidth=1;
  for(let y=1;y<H;y++){
    for(let x=1;x<W;x++){
      const d=getDepth(x/W,y/H),d2=getDepth((x-1)/W,y/H);
      for(const t of [0.15,0.30,0.45,0.60,0.75]){
        if((d<t&&d2>=t)||(d>=t&&d2<t)){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+1,y+1);ctx.stroke();}
      }
    }
  }
}

const RANK_COLORS=['#22c55e','#eab308','#f97316'];
const RANK_LABELS=['#1 AI Pick','#2 AI Pick','#3 AI Pick'];
const DEPTH_LEGEND=[
  {color:'#b4e6ff',label:'0-3 ft'},{color:'#64bef0',label:'3-8 ft'},
  {color:'#288cd2',label:'8-15 ft'},{color:'#145aaa',label:'15-25 ft'},
  {color:'#0a3282',label:'25-40 ft'},{color:'#05195a',label:'40+ ft'},
];

export default function MapView({spots,onSpotSelect,aiPicks=[]}:{spots:Spot[];onSpotSelect:(s:Spot)=>void;aiPicks?:string[]}){
  const [activeLayers,setActiveLayers]=useState<Set<string>>(new Set(['spots','depth']));
  const [selected,setSelected]=useState<Spot|null>(null);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const containerRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const canvas=canvasRef.current,container=containerRef.current;
    if(!canvas||!container) return;
    canvas.width=container.clientWidth||360;
    canvas.height=container.clientHeight||520;
    drawDepthMap(canvas);
  },[]);

  function toggleLayer(id:string){setActiveLayers(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});}
  function selectSpot(s:Spot){setSelected(s);onSpotSelect(s);}
  const rankOf=(id:string)=>aiPicks.indexOf(id);

  return(
    <div ref={containerRef} style={{position:'relative',height:'100%',background:'#061020',overflow:'hidden'}}>
      <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:activeLayers.has('depth')?1:0,transition:'opacity 0.4s'}}/>
      {!activeLayers.has('depth')&&<div style={{position:'absolute',inset:0,background:'#0a1628'}}/>}

      <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
        {[...Array(8)].map((_,i)=><div key={i} style={{position:'absolute',left:0,right:0,top:`${i*14}%`,height:'1px',background:'rgba(255,255,255,0.04)'}}/>)}
        {[...Array(6)].map((_,i)=><div key={i} style={{position:'absolute',top:0,bottom:0,left:`${i*20}%`,width:'1px',background:'rgba(255,255,255,0.04)'}}/>)}
      </div>

      {activeLayers.has('heat')&&<div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 42% 55%,rgba(249,115,22,0.25) 0%,transparent 45%),radial-gradient(ellipse at 68% 28%,rgba(239,68,68,0.18) 0%,transparent 35%)',pointerEvents:'none',zIndex:2}}/>}

      {activeLayers.has('weather')&&<div style={{position:'absolute',top:'44px',left:'12px',right:'12px',display:'flex',justifyContent:'space-around',zIndex:5,pointerEvents:'none'}}>
        {['💨 SW 8mph','🌡 74F','☁️ Partly','🌊 Calm'].map(w=><span key={w} style={{fontSize:'9px',color:'rgba(34,197,94,0.9)',background:'rgba(0,0,0,0.55)',padding:'2px 5px',borderRadius:'4px'}}>{w}</span>)}
      </div>}

      {activeLayers.has('spots')&&spots.map((s,i)=>{
        const rank=rankOf(s.id),x=10+(i*37)%80,y=15+(i*23)%65;
        return rank>=0?<div key={s.id+'r'} style={{position:'absolute',left:`${x}%`,top:`${y}%`,transform:'translate(-50%,-50%)',width:'54px',height:'54px',borderRadius:'50%',border:`2px solid ${RANK_COLORS[rank]}`,opacity:0.5,animation:'pulse 2s ease-in-out infinite',pointerEvents:'none',zIndex:3}}/>:null;
      })}

      {activeLayers.has('spots')&&spots.map((s,i)=>{
        const rank=rankOf(s.id),x=10+(i*37)%80,y=15+(i*23)%65,isSel=selected?.id===s.id,isAI=rank>=0,sc=score(s);
        return(
          <div key={s.id} style={{position:'absolute',left:`${x}%`,top:`${y}%`,transform:'translate(-50%,-50%)',zIndex:isAI?6:isSel?5:4}}>
            {isAI&&<div style={{position:'absolute',top:'-20px',left:'50%',transform:'translateX(-50%)',background:RANK_COLORS[rank],color:'white',fontSize:'7px',fontWeight:'bold',padding:'2px 5px',borderRadius:'4px',whiteSpace:'nowrap'}}>{RANK_LABELS[rank]}</div>}
            <button onClick={()=>selectSpot(s)} style={{background:isAI?RANK_COLORS[rank]+'55':isSel?'#0ea5e944':'rgba(14,165,233,0.15)',border:`2px solid ${isAI?RANK_COLORS[rank]:isSel?'#7dd3fc':'#0ea5e9'}`,borderRadius:'50%',width:isAI?'38px':isSel?'34px':'28px',height:isAI?'38px':isSel?'34px':'28px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:isAI?'17px':'13px',cursor:'pointer',transition:'all 0.2s',boxShadow:isAI?`0 0 18px ${RANK_COLORS[rank]}88`:isSel?'0 0 12px rgba(14,165,233,0.5)':'none'}}>🎣</button>
            {isAI&&<div style={{position:'absolute',bottom:'-14px',left:'50%',transform:'translateX(-50%)',fontSize:'8px',color:RANK_COLORS[rank],fontWeight:'bold',whiteSpace:'nowrap'}}>{sc}</div>}
          </div>
        );
      })}

      <style>{`@keyframes pulse{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.5}50%{transform:translate(-50%,-50%) scale(1.5);opacity:0.1}}`}</style>

      <div style={{position:'absolute',top:'12px',right:'12px',zIndex:20,display:'flex',flexDirection:'column',gap:'4px'}}>
        {LAYERS.map(l=><button key={l.id} onClick={()=>toggleLayer(l.id)} style={{background:activeLayers.has(l.id)?l.color+'33':'rgba(10,15,30,0.85)',border:`1px solid ${activeLayers.has(l.id)?l.color:'#1e293b'}`,borderRadius:'8px',color:activeLayers.has(l.id)?l.color:'#475569',padding:'6px 10px',fontSize:'10px',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px',fontWeight:'bold',backdropFilter:'blur(8px)',whiteSpace:'nowrap'}}>{l.icon} {l.label}</button>)}
      </div>

      {activeLayers.has('depth')&&(
        <div style={{position:'absolute',bottom:selected?'122px':'12px',left:'12px',zIndex:20,background:'rgba(6,16,32,0.92)',border:'1px solid #1e293b',borderRadius:'8px',padding:'8px 10px',backdropFilter:'blur(8px)',transition:'bottom 0.3s'}}>
          <div style={{fontSize:'9px',color:'#475569',marginBottom:'5px',fontWeight:'bold'}}>DEPTH</div>
          {DEPTH_LEGEND.map(d=><div key={d.label} style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'3px'}}><div style={{width:'22px',height:'8px',borderRadius:'2px',background:d.color,border:'1px solid rgba(255,255,255,0.1)'}}/><span style={{fontSize:'9px',color:'#94a3b8'}}>{d.label}</span></div>)}
        </div>
      )}

      <div style={{position:'absolute',top:'12px',left:'12px',zIndex:20,background:'rgba(6,16,32,0.92)',border:'1px solid #1e293b',borderRadius:'8px',padding:'8px 10px',backdropFilter:'blur(8px)'}}>
        <div style={{fontSize:'9px',color:'#475569',marginBottom:'5px',fontWeight:'bold'}}>AI TOP PICKS</div>
        {RANK_COLORS.map((col,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'3px'}}><div style={{width:'8px',height:'8px',borderRadius:'50%',background:col}}/><span style={{fontSize:'9px',color:col}}>{RANK_LABELS[i]}</span></div>)}
      </div>

      {selected&&(
        <div style={{position:'absolute',bottom:'12px',left:'12px',right:'12px',background:'rgba(6,16,32,0.97)',border:`1px solid ${rankOf(selected.id)>=0?RANK_COLORS[rankOf(selected.id)]:'#0ea5e9'}`,borderRadius:'12px',padding:'12px',backdropFilter:'blur(16px)',zIndex:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              {rankOf(selected.id)>=0&&<div style={{fontSize:'9px',color:RANK_COLORS[rankOf(selected.id)],fontWeight:'bold',marginBottom:'2px'}}>{RANK_LABELS[rankOf(selected.id)]} - Score {score(selected)}</div>}
              <div style={{fontSize:'13px',fontWeight:'bold',color:'#e2e8f0',marginBottom:'2px'}}>{selected.name}</div>
              <div style={{fontSize:'10px',color:'#64748b'}}>{selected.water_type} - {selected.spot_type}</div>
            </div>
            <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',color:'#475569',fontSize:'18px',cursor:'pointer',lineHeight:1}}>x</button>
          </div>
          <div style={{display:'flex',gap:'8px',marginTop:'10px'}}>
            <button style={{flex:1,background:'linear-gradient(135deg,#0369a1,#0ea5e9)',color:'white',border:'none',padding:'8px',borderRadius:'8px',fontSize:'11px',fontWeight:'bold',cursor:'pointer'}}>Navigate</button>
            <button style={{flex:1,background:'#0f172a',border:'1px solid #334155',color:'#94a3b8',padding:'8px',borderRadius:'8px',fontSize:'11px',cursor:'pointer'}}>Details</button>
          </div>
        </div>
      )}
    </div>
  );
}
