'use client';
/* eslint-disable @next/next/no-img-element -- feed cards use local catalog image assets. */
import { useState } from 'react';
import { SPECIES_BY_NAME, type SpeciesName } from '@/lib/speciesCatalog';

interface FeedPost {
  id: string;
  user: string;
  avatar: string;
  species: SpeciesName;
  weight: string;
  spot: string;
  time: string;
  likes: number;
  comment: string;
}

const FEED: readonly FeedPost[] = [
  { id: '1', user: 'FishKing_TX', avatar: '🎣', species: 'Largemouth Bass', weight: '6.4', spot: 'Lake Fork', time: '12 min ago', likes: 14, comment: 'Crushed it on a frog this morning!' },
  { id: '2', user: 'CoastalAngler', avatar: '🌊', species: 'Red Drum', weight: '9.1', spot: 'Galveston Bay', time: '34 min ago', likes: 27, comment: 'Bull red on live crab. Monster fish!' },
  { id: '3', user: 'BassPro_Dale', avatar: '🏆', species: 'Striped Bass', weight: '12.3', spot: 'Sabine Lake', time: '1 hr ago', likes: 41, comment: 'New PB!! Could not believe it.' },
  { id: '4', user: 'NightOwlFisher', avatar: '🌙', species: 'Channel Catfish', weight: '18.5', spot: 'Caddo Lake', time: '2 hr ago', likes: 19, comment: 'Bottom fishing at midnight always delivers.' },
  { id: '5', user: 'PierQueen_Gail', avatar: '🎀', species: 'Southern Flounder', weight: '3.2', spot: 'Bolivar Pier', time: '3 hr ago', likes: 8, comment: 'Limits on flounder today!' },
  { id: '6', user: 'FlyGuy_Tex', avatar: '🪰', species: 'Rainbow Trout', weight: '2.8', spot: 'Guadalupe River', time: '4 hr ago', likes: 22, comment: 'Fly fishing the Guadalupe never disappoints.' },
];

const LEADERBOARD = [
  { rank: 1, user: 'BassPro_Dale', catches: 47, topWeight: '12.3', badge: '🥇' },
  { rank: 2, user: 'CoastalAngler', catches: 38, topWeight: '9.1', badge: '🥈' },
  { rank: 3, user: 'NightOwlFisher', catches: 34, topWeight: '18.5', badge: '🥉' },
  { rank: 4, user: 'FishKing_TX', catches: 29, topWeight: '6.4', badge: '4️⃣' },
  { rank: 5, user: 'PierQueen_Gail', catches: 21, topWeight: '5.8', badge: '5️⃣' },
];

export default function SocialTab() {
  const [tab, setTab] = useState<'feed' | 'leaderboard'>('feed');
  const [liked, setLiked] = useState<Set<string>>(new Set());

  function toggleLike(id: string) {
    setLiked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#060d1a' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#22d3ee', marginBottom: '10px' }}>Community</div>
        <div style={{ display: 'flex', background: '#0f172a', borderRadius: '10px', padding: '3px', gap: '3px' }}>
          {(['feed', 'leaderboard'] as const).map((view) => (
            <button key={view} onClick={() => setTab(view)} style={{ flex: 1, background: tab === view ? '#0ea5e9' : 'transparent', border: 'none', color: tab === view ? 'white' : '#64748b', padding: '7px', borderRadius: '7px', fontSize: '11px', fontWeight: tab === view ? 'bold' : 'normal', cursor: 'pointer' }}>
              {view === 'feed' ? '📰 Nearby Feed' : '🏆 Leaderboard'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tab === 'feed' && FEED.map((post) => {
          const species = SPECIES_BY_NAME[post.species];
          return (
            <div key={post.id} style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '12px', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ fontSize: '24px' }}>{post.avatar}</div>
                <div><div style={{ fontSize: '12px', fontWeight: 'bold', color: '#e2e8f0' }}>{post.user}</div><div style={{ fontSize: '9px', color: '#64748b' }}>{post.time} · {post.spot}</div></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0f172a', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                <img src={species.image} alt={species.imageAlt} width={56} height={44} style={{ width: '56px', height: '44px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #1e4080' }} />
                <div><div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0' }}>{post.species}</div><div style={{ fontSize: '11px', color: '#0ea5e9', fontWeight: 'bold' }}>{post.weight} lbs</div></div>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontStyle: 'italic' }}>&quot;{post.comment}&quot;</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => toggleLike(post.id)} style={{ background: liked.has(post.id) ? 'rgba(239,68,68,0.15)' : '#0f172a', border: `1px solid ${liked.has(post.id) ? '#ef4444' : '#334155'}`, color: liked.has(post.id) ? '#ef4444' : '#64748b', padding: '5px 12px', borderRadius: '16px', fontSize: '11px', cursor: 'pointer' }}>
                  {liked.has(post.id) ? '❤️' : '🤍'} {post.likes + (liked.has(post.id) ? 1 : 0)}
                </button>
                <button style={{ background: '#0f172a', border: '1px solid #334155', color: '#64748b', padding: '5px 12px', borderRadius: '16px', fontSize: '11px', cursor: 'pointer' }}>💬 Reply</button>
              </div>
            </div>
          );
        })}
        {tab === 'leaderboard' && (
          <div>
            <div style={{ background: 'linear-gradient(135deg,#1a1000,#0a0f1e)', border: '1px solid #854d0e', borderRadius: '12px', padding: '14px', marginBottom: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#eab308', fontWeight: 'bold', marginBottom: '4px' }}>THIS MONTH</div>
              <div style={{ fontSize: '13px', color: '#fbbf24' }}>August 2026 Rankings</div>
            </div>
            {LEADERBOARD.map((user) => (
              <div key={user.rank} style={{ background: '#0a0f1e', border: `1px solid ${user.rank === 1 ? '#eab308' : user.rank === 2 ? '#94a3b8' : user.rank === 3 ? '#cd7c2f' : '#1e293b'}`, borderRadius: '12px', padding: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '22px' }}>{user.badge}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0' }}>{user.user}</div><div style={{ fontSize: '10px', color: '#64748b' }}>{user.catches} catches · Top: {user.topWeight} lbs</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: '16px', fontWeight: 'bold', color: '#22d3ee' }}>{user.catches}</div><div style={{ fontSize: '8px', color: '#64748b' }}>CATCHES</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
