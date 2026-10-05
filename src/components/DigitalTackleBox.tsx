import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GearManager } from '@/lib/gear/manager';
import { GearItem } from '@/lib/gear/types';

/* eslint-disable react-hooks/set-state-in-effect -- initial async load hydrates external IndexedDB-backed state. */

export default function DigitalTackleBox() {
  const [inventory, setInventory] = useState<GearItem[]>([]);
  const userId = 'user_1';

  async function loadInventory() {
    const data = await GearManager.getInventory(userId);
    setInventory(data);
  }

  useEffect(() => {
    void loadInventory();
  }, []);

  async function addQuickGear() {
    const item: GearItem = {
      id: crypto.randomUUID(),
      name: 'Z-Man ChatterBait',
      category: 'lure',
      quantity: 1,
      spec: '1/2 oz, White/Chartreuse',
      brand: 'Z-Man',
      affiliateUrl: 'https://www.amazon.com/s?k=zman+chatterbait'
    };
    await GearManager.addGear(userId, item);
    await loadInventory();
  }

  return (
    <div style={{ padding: '20px', color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>📦 Digital Tackle Box</h2>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Manage your gear & refill supplies</span>
        </div>
        <button 
          onClick={addQuickGear}
          style={{ background: '#0891b2', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          + Add Gear
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {inventory.length === 0 ? (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', color: '#64748b', marginTop: '40px' }}>Your tackle box is empty!</div>
        ) : (
          inventory.map(item => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ 
                background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', 
                borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.name}</div>
                <div style={{ fontSize: '10px', color: '#22d3ee', fontWeight: 'bold' }}>{item.category.toUpperCase()}</div>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.spec}</div>
              {item.brand && <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>{item.brand}</div>}
              
              {item.affiliateUrl && (
                <motion.a 
                  href={item.affiliateUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ 
                    marginTop: '8px', background: '#fbbf24', color: '#000', 
                    fontSize: '10px', fontWeight: 'bold', textAlign: 'center', 
                    padding: '4px', borderRadius: '6px', textDecoration: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  🛒 Buy Replacement
                </motion.a>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
