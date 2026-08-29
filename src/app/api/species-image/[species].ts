import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Species with pre-generated/stock images
const STOCK_IMAGES: Record<string, string> = {
  'Largemouth Bass': '/species/largemouth-bass.jpg',
  'Smallmouth Bass': '/species/smallmouth-bass.jpg',
  'Spotted Bass': '/species/spotted-bass.jpg',
  'Channel Catfish': '/species/channel-catfish.jpg',
  'Blue Catfish': '/species/blue-catfish.jpg',
  'Flathead Catfish': '/species/flathead-catfish.jpg',
  'Walleye': '/species/walleye.jpg',
  'Rainbow Trout': '/species/rainbow-trout.jpg',
  'Brown Trout': '/species/brown-trout.jpg',
  'Crappie': '/species/crappie.jpg',
  'Black Crappie': '/species/black-crappie.jpg',
  'White Crappie': '/species/white-crappie.jpg',
  'Bluegill': '/species/bluegill.jpg',
  'Redear Sunfish': '/species/redear-sunfish.jpg',
  'Striped Bass': '/species/striped-bass.jpg',
  'White Bass': '/species/white-bass.jpg',
  'Hybrid Striper': '/species/hybrid-striper.jpg',
  'Redfish/Red Drum': '/species/redfish-red-drum.jpg',
  'Flounder': '/species/flounder.jpg',
  'Sauger': '/species/sauger.jpg',
  'Common Carp': '/species/common-carp.jpg',
  'Northern Pike': '/species/northern-pike.jpg',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { species: string } }
) {
  const speciesName = decodeURIComponent(params.species);

  // Check if we have a stock image for this species
  if (STOCK_IMAGES[speciesName]) {
    return NextResponse.redirect(new URL(STOCK_IMAGES[speciesName], request.url));
  }

  // Generate SVG placeholder with species name
  // This will be replaced with actual DALL-E images later
  const svg = generateSpeciesSVG(speciesName);

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}

function generateSpeciesSVG(speciesName: string): string {
  // Generate a color based on species name
  const hash = Array.from(speciesName).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0
  );
  const hue = (hash % 360).toString();
  const color1 = `hsl(${hue}, 70%, 50%)`;
  const color2 = `hsl(${(hash + 60) % 360}, 70%, 60%)`;

  // Create a simple fish-like SVG shape with gradient
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
      <defs>
        <linearGradient id="fishGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="400" height="300" fill="#e8f4f8"/>
      
      <!-- Water waves -->
      <circle cx="80" cy="60" r="40" fill="none" stroke="#b3d9e8" stroke-width="2" opacity="0.5"/>
      <circle cx="320" cy="250" r="50" fill="none" stroke="#b3d9e8" stroke-width="2" opacity="0.5"/>
      
      <!-- Fish body -->
      <ellipse cx="200" cy="150" rx="90" ry="50" fill="url(#fishGradient)" filter="url(#shadow)"/>
      
      <!-- Fish head -->
      <circle cx="140" cy="145" r="35" fill="url(#fishGradient)" filter="url(#shadow)"/>
      
      <!-- Fish tail -->
      <polygon points="290,150 360,120 360,180" fill="url(#fishGradient)" filter="url(#shadow)"/>
      
      <!-- Fish fin -->
      <polygon points="200,100 200,50 220,85" fill="${color2}" opacity="0.7"/>
      
      <!-- Eye -->
      <circle cx="125" cy="140" r="6" fill="white"/>
      <circle cx="126" cy="140" r="3" fill="black"/>
      
      <!-- Mouth -->
      <path d="M 105 150 Q 100 155 105 160" stroke="rgba(0,0,0,0.3)" stroke-width="2" fill="none" stroke-linecap="round"/>
      
      <!-- Species name -->
      <text x="200" y="280" font-family="Arial, sans-serif" font-size="16" font-weight="bold" 
            text-anchor="middle" fill="#333" word-wrap="break-word">${speciesName}</text>
      
      <!-- AI Generated badge -->
      <text x="200" y="300" font-family="Arial, sans-serif" font-size="11" 
            text-anchor="middle" fill="#666" opacity="0.7">AI Generated</text>
    </svg>
  `;
}
