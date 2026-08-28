'use client';
import { useEffect, useState } from 'react';

interface DayForecast {
  name: string;
  temp: number;
  tempUnit: string;
  wind: string;
  shortForecast: string;
  isDaytime: boolean;
  icon: string;
}

interface Props { lat: number; lng: number; }

function weatherEmoji(forecast: string): string {
  const f = forecast.toLowerCase();
  if (f.includes('thunder')) return '⛈';
  if (f.includes('rain') || f.includes('shower')) return '🌧';
  if (f.includes('snow')) return '❄️';
  if (f.includes('cloud') && f.includes('partly')) return '⛅';
  if (f.includes('cloud') || f.includes('overcast')) return '☁️';
  if (f.includes('fog')) return '🌫';
  if (f.includes('wind')) return '💨';
  return '☀️';
}

function fishingRatingFromWeather(forecast: string, wind: string): { rating: number; color: string; label: string } {
  const f = forecast.toLowerCase();
  const windSpeed = parseInt(wind.match(/(d+)/)?.[1] ?? '0');
  let score = 70;
  if (f.includes('thunder')) score = 10;
  else if (f.includes('heavy rain')) score -= 30;
  else if (f.includes('rain')) score -= 15;
  else if (f.includes('partly')) score += 5;
  else if (f.includes('sunny') || f.includes('clear')) score += 10;
  if (windSpeed > 20) score -= 25;
  else if (windSpeed > 12) score -= 10;
  else if (windSpeed >= 5 && windSpeed <= 12) score += 5;
  score = Math.max(5, Math.min(100, score));
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#eab308' : score >= 25 ? '#f97316' : '#ef4444';
  const label = score >= 70 ? 'Great' : score >= 45 ? 'Good' : score >= 25 ? 'Fair' : 'Poor';
  return { rating: score, color, label };
}

export default function SevenDayForecast({ lat, lng }: Props) {
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
          { headers: { 'User-Agent': 'FishFinderPro/1.0 (contact@fishfinderpro.app)' } });
        const point = await pointRes.json();
        const fRes = await fetch(point.properties.forecast,
          { headers: { 'User-Agent': 'FishFinderPro/1.0' } });
        const data = await fRes.json();
        setForecast(data.properties.periods.slice(0, 14).filter((p: DayForecast) => p.isDaytime));
      } catch {
        setError('Unable to load 7-day forecast');
      } finally { setLoading(false); }
    };
    load();
  }, [lat, lng]);

  if (loading) return <p style={{ color:'#3b82f6', fontSize:'11px', textAlign:'center', padding:'12px 0' }}>⏳ Loading 7-day forecast...</p>;
  if (error)   return <p style={{ color:'#ef4444', fontSize:'11px', textAlign:'center' }}>{error}</p>;

  return (
    <div>
      <div style={{ fontSize:'10px', color:'#64748b', fontWeight:'bold', marginBottom:'8px' }}>☀️ 7-DAY FISHING FORECAST</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
        {forecast.map((day, i) => {
          const rating = fishingRatingFromWeather(day.shortForecast, day.wind);
          const tempC  = Math.round(((day.temp - 32) * 5) / 9);
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px', background:'#0f172a', borderRadius:'6px', padding:'6px 8px' }}>
              <span style={{ fontSize:'16px', minWidth:'22px' }}>{weatherEmoji(day.shortForecast)}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'11px', fontWeight:'bold', color:'#e2e8f0' }}>{day.name}</div>
                <div style={{ fontSize:'9px', color:'#64748b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {day.shortForecast} · {day.wind}
                </div>
              </div>
              <div style={{ textAlign:'right', minWidth:'60px' }}>
                <div style={{ fontSize:'11px', color:'#94a3b8' }}>{tempC}°C</div>
                <div style={{ fontSize:'10px', fontWeight:'bold', color: rating.color }}>{rating.label}</div>
              </div>
              <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:`conic-gradient(${rating.color} ${rating.rating * 3.6}deg, #1e293b 0)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'8px', fontWeight:'bold', color:'white' }}>{rating.rating}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
