import React, { useState } from 'react';

interface GearItem {
  item: string;
  spec: string;
  priority: 'Essential' | 'Recommended';
  reason: string;
}

interface GearChecklistProps {
  items: GearItem[];
}

export default function GearChecklist({ items }: GearChecklistProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggleItem = (item: string) => {
    setChecked(prev => ({ ...prev, [item]: !prev[item] }));
  };

  return (
    <div style={{ 
      background: 'rgba(15, 23, 42, 0.6)', 
      border: '1px solid #334155', 
      borderRadius: '12px', 
      padding: '14px', 
      marginTop: '16px' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '16px' }}>🎒</span>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }}>Pro Gear Checklist</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((gear, idx) => (
          <div 
            key={idx} 
            onClick={() => toggleItem(gear.item)}
            style={{ 
              display: 'flex', alignItems: 'flex-start', gap: '12px', 
              cursor: 'pointer', padding: '8px', borderRadius: '8px',
              background: checked[gear.item] ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
              transition: 'all 0.2s',
              textDecoration: checked[gear.item] ? 'line-through' : 'none',
              opacity: checked[gear.item] ? 0.6 : 1
            }}
          >
            <div style={{ 
              width: '18px', height: '18px', borderRadius: '4px', border: '2px solid #0891b2', 
              backgroundColor: checked[gear.item] ? '#0891b2' : 'transparent',
              flexShrink: 0, marginTop: '2px',
              transition: 'background 0.2s'
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0' }}>{gear.item}</span>
                <span style={{ 
                  fontSize: '9px', padding: '1px 4px', borderRadius: '4px', 
                  background: gear.priority === 'Essential' ? '#ef4444' : '#3b82f6', 
                  color: 'white', fontWeight: 'bold' 
                }}>
                  {gear.priority}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{gear.spec}</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>{gear.reason}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
