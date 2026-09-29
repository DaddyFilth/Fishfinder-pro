export interface GearItem {
  id: string;
  name: string;
  category: 'rod' | 'reel' | 'lure' | 'accessory';
  quantity: number;
  spec: string;
  affiliateUrl?: string; // URL to purchase this item or a similar one
  brand?: string;
}

export interface DigitalTackleBox {
  userId: string;
  inventory: GearItem[];
}

export const TACKLE_BOX_STORE = 'digital_tackle_box';
