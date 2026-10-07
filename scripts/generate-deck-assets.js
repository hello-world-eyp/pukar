import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CARDS_DIR = path.resolve(__dirname, '../public/cards');

if (!fs.existsSync(CARDS_DIR)) {
  fs.mkdirSync(CARDS_DIR, { recursive: true });
}

// Color palettes matching reference image
const PALETTE = {
  bg: '#FAF7EE',
  bgGradientEnd: '#F4EFE0',
  cardBorder: '#D8D1BE',
  redMain: '#C53929',
  redAccent: '#E06D53',
  redDark: '#8F2218',
  blackMain: '#1A2438',
  blackAccent: '#2D3E5E',
  gold: '#D6A449',
  goldLight: '#E8C57A',
  teal: '#2A6F6D',
  tealLight: '#449896',
  purple: '#5B3E6E',
  coral: '#E76F51',
};

// SVG Paths for ornate suit pips
function getSpadePip(x, y, scale = 1, flipped = false) {
  const transform = `translate(${x}, ${y}) scale(${scale}) ${flipped ? 'rotate(180)' : ''}`;
  return `
    <g transform="${transform}">
      <!-- Outer Spade Body -->
      <path d="M 0,-48 C -22,-20 -44,6 -44,22 C -44,38 -28,44 -14,40 C -4,37 0,26 0,26 C 0,26 4,37 14,40 C 28,44 44,38 44,22 C 44,6 22,-20 0,-48 Z" 
            fill="${PALETTE.blackMain}" stroke="${PALETTE.blackAccent}" stroke-width="2"/>
      <!-- Flared Stem -->
      <path d="M -8,28 Q -8,46 -20,52 L 20,52 Q 8,46 8,28 Z" fill="${PALETTE.blackMain}"/>
      <!-- Botanical Leaf Filigree inside -->
      <path d="M 0,-34 Q -10,-10 -6,16 Q 0,8 0,-34 Z" fill="${PALETTE.teal}"/>
      <path d="M 0,-34 Q 10,-10 6,16 Q 0,8 0,-34 Z" fill="${PALETTE.teal}"/>
      <path d="M -16,4 Q -28,18 -18,28 Q -8,22 -16,4 Z" fill="${PALETTE.gold}"/>
      <path d="M 16,4 Q 28,18 18,28 Q 8,22 16,4 Z" fill="${PALETTE.gold}"/>
      <circle cx="0" cy="2" r="3" fill="${PALETTE.goldLight}"/>
    </g>
  `;
}

function getHeartPip(x, y, scale = 1, flipped = false) {
  const transform = `translate(${x}, ${y}) scale(${scale}) ${flipped ? 'rotate(180)' : ''}`;
  return `
    <g transform="${transform}">
      <!-- Outer Heart Body -->
      <path d="M 0,44 C -4,40 -42,12 -42,-14 C -42,-34 -24,-46 0,-26 C 24,-46 42,-34 42,-14 C 42,12 4,40 0,44 Z" 
            fill="${PALETTE.redMain}" stroke="${PALETTE.redDark}" stroke-width="2"/>
      <!-- Botanical Tulip / Vine Motif inside -->
      <path d="M 0,-18 C -12,-30 -26,-14 -16,6 C -8,2 -4,-6 0,-18 Z" fill="${PALETTE.redAccent}"/>
      <path d="M 0,-18 C 12,-30 26,-14 16,6 C 8,2 4,-6 0,-18 Z" fill="${PALETTE.redAccent}"/>
      <path d="M 0,-6 Q -8,14 0,30 Q 8,14 0,-6 Z" fill="${PALETTE.gold}"/>
      <circle cx="0" cy="-6" r="4" fill="${PALETTE.goldLight}"/>
      <circle cx="-16" cy="-14" r="2.5" fill="${PALETTE.teal}"/>
      <circle cx="16" cy="-14" r="2.5" fill="${PALETTE.teal}"/>
    </g>
  `;
}

function getClubPip(x, y, scale = 1, flipped = false) {
  const transform = `translate(${x}, ${y}) scale(${scale}) ${flipped ? 'rotate(180)' : ''}`;
  return `
    <g transform="${transform}">
      <!-- Three Trefoil Lobes -->
      <circle cx="0" cy="-24" r="22" fill="${PALETTE.blackMain}"/>
      <circle cx="-23" cy="8" r="22" fill="${PALETTE.blackMain}"/>
      <circle cx="23" cy="8" r="22" fill="${PALETTE.blackMain}"/>
      <circle cx="0" cy="-2" r="16" fill="${PALETTE.blackMain}"/>
      <!-- Flared Stem -->
      <path d="M -8,12 Q -8,44 -20,50 L 20,50 Q 8,44 8,12 Z" fill="${PALETTE.blackMain}"/>
      <!-- Botanical Foliage inside -->
      <path d="M 0,-38 Q -8,-24 0,-14 Q 8,-24 0,-38 Z" fill="${PALETTE.teal}"/>
      <path d="M -30,6 Q -18,0 -12,12 Q -22,18 -30,6 Z" fill="${PALETTE.gold}"/>
      <path d="M 30,6 Q 18,0 12,12 Q 22,18 30,6 Z" fill="${PALETTE.gold}"/>
      <circle cx="0" cy="-2" r="3.5" fill="${PALETTE.goldLight}"/>
    </g>
  `;
}

function getDiamondPip(x, y, scale = 1, flipped = false) {
  const transform = `translate(${x}, ${y}) scale(${scale}) ${flipped ? 'rotate(180)' : ''}`;
  return `
    <g transform="${transform}">
      <!-- Outer Diamond Body -->
      <path d="M 0,-48 L 38,0 L 0,48 L -38,0 Z" 
            fill="${PALETTE.redMain}" stroke="${PALETTE.redDark}" stroke-width="2"/>
      <!-- Geometric Gem Facets inside -->
      <path d="M 0,-34 L 24,0 L 0,34 L -24,0 Z" fill="${PALETTE.redAccent}"/>
      <path d="M 0,-20 L 14,0 L 0,20 L -14,0 Z" fill="${PALETTE.gold}"/>
      <circle cx="0" cy="0" r="4" fill="${PALETTE.goldLight}"/>
      <circle cx="0" cy="-34" r="2.5" fill="${PALETTE.teal}"/>
      <circle cx="0" cy="34" r="2.5" fill="${PALETTE.teal}"/>
    </g>
  `;
}

function renderPip(suit, x, y, scale = 1, flipped = false) {
  switch (suit) {
    case 'SPADES':
      return getSpadePip(x, y, scale, flipped);
    case 'HEARTS':
      return getHeartPip(x, y, scale, flipped);
    case 'CLUBS':
      return getClubPip(x, y, scale, flipped);
    case 'DIAMONDS':
      return getDiamondPip(x, y, scale, flipped);
  }
}

// Little filigree stars and flourishes between pips
function renderFlourish(x, y, color = PALETTE.gold) {
  return `
    <g transform="translate(${x}, ${y})">
      <path d="M 0,-10 Q 0,0 10,0 Q 0,0 0,10 Q 0,0 -10,0 Q 0,0 0,-10 Z" fill="${color}"/>
      <circle cx="-14" cy="0" r="2" fill="${PALETTE.teal}"/>
      <circle cx="14" cy="0" r="2" fill="${PALETTE.teal}"/>
    </g>
  `;
}

// Ace Large Centerpiece
function renderAceCenterpiece(suit) {
  let mainSymbol = '';
  switch (suit) {
    case 'SPADES':
      mainSymbol = getSpadePip(300, 440, 2.7);
      break;
    case 'HEARTS':
      mainSymbol = getHeartPip(300, 440, 2.7);
      break;
    case 'CLUBS':
      mainSymbol = getClubPip(300, 440, 2.7);
      break;
    case 'DIAMONDS':
      mainSymbol = getDiamondPip(300, 440, 2.7);
      break;
  }
  const isRed = suit === 'HEARTS' || suit === 'DIAMONDS';
  const textColor = isRed ? PALETTE.redMain : PALETTE.blackMain;

  return `
    <!-- Top Celestial Star -->
    <g transform="translate(300, 190) scale(1.6)">
      <polygon points="0,-16 4.5,-4 16,-4 7,4 10.5,15 0,8 -10.5,15 -7,4 -16,-4 -4.5,-4" fill="${PALETTE.teal}"/>
    </g>
    <!-- Giant Botanical Suit Symbol -->
    ${mainSymbol}
    <!-- ACE Label -->
    <text x="300" y="730" font-family="'Georgia', 'Times New Roman', serif" font-weight="900" font-size="34" 
          letter-spacing="10" text-anchor="middle" fill="${textColor}">ACE</text>
  `;
}

// Court Card Centerpieces (Kings, Queens, Jacks)
function renderCourtCenterpiece(suit, rankStr) {
  const isRed = suit === 'HEARTS' || suit === 'DIAMONDS';
  const primaryColor = isRed ? PALETTE.redMain : PALETTE.blackMain;
  const secondaryColor = isRed ? PALETTE.purple : PALETTE.teal;
  const robeColor = isRed ? PALETTE.redAccent : PALETTE.teal;

  if (rankStr === 'K') {
    return `
      <!-- King Illustration -->
      <g transform="translate(300, 450)">
        <!-- Halo / Arch Frame -->
        <path d="M -140,-210 C -140,-260 140,-260 140,-210 L 140,240 L -140,240 Z" fill="${PALETTE.bg}" stroke="${primaryColor}" stroke-width="3"/>
        <!-- Shoulders / Robe -->
        <path d="M -130,240 Q -140,60 0,60 Q 140,60 130,240 Z" fill="${secondaryColor}" stroke="${PALETTE.blackMain}" stroke-width="4"/>
        <path d="M -60,60 L 60,60 L 80,240 L -80,240 Z" fill="${robeColor}" stroke="${PALETTE.blackMain}" stroke-width="3"/>
        <!-- Ermine Collar -->
        <path d="M -70,50 Q 0,110 70,50 Q 0,30 -70,50 Z" fill="#FFFFFF" stroke="${PALETTE.blackMain}" stroke-width="3"/>
        <circle cx="-35" cy="55" r="3" fill="${PALETTE.blackMain}"/>
        <circle cx="0" cy="70" r="3" fill="${PALETTE.blackMain}"/>
        <circle cx="35" cy="55" r="3" fill="${PALETTE.blackMain}"/>
        <!-- King Head & Beard -->
        <path d="M -45,-50 C -55,60 55,60 45,-50 Z" fill="${PALETTE.goldLight}"/>
        <!-- Beard -->
        <path d="M -48,-10 C -55,80 55,80 48,-10 C 25,40 -25,40 -48,-10 Z" fill="#6B4423" stroke="${PALETTE.blackMain}" stroke-width="3"/>
        <!-- Face -->
        <circle cx="-16" cy="-22" r="4" fill="${PALETTE.blackMain}"/>
        <circle cx="16" cy="-22" r="4" fill="${PALETTE.blackMain}"/>
        <path d="M -12,8 Q 0,16 12,8" fill="none" stroke="${PALETTE.blackMain}" stroke-width="3" stroke-linecap="round"/>
        <!-- Mustache -->
        <path d="M -26,-2 Q 0,12 26,-2 Q 10,2 -26,-2 Z" fill="#523214"/>
        <!-- Crown -->
        <path d="M -45,-50 L -45,-90 L -22,-65 L 0,-100 L 22,-65 L 45,-90 L 45,-50 Z" fill="${PALETTE.gold}" stroke="${PALETTE.blackMain}" stroke-width="3"/>
        <circle cx="0" cy="-70" r="5" fill="${isRed ? PALETTE.redMain : PALETTE.teal}"/>
        <circle cx="-30" cy="-65" r="4" fill="${PALETTE.goldLight}"/>
        <circle cx="30" cy="-65" r="4" fill="${PALETTE.goldLight}"/>
        <!-- Scepter -->
        <g transform="translate(-100, 40)">
          <line x1="0" y1="-180" x2="0" y2="150" stroke="${PALETTE.gold}" stroke-width="8" stroke-linecap="round"/>
          ${renderPip(suit, 0, -190, 0.7)}
        </g>
      </g>
    `;
  }

  if (rankStr === 'Q') {
    return `
      <!-- Queen Illustration -->
      <g transform="translate(300, 450)">
        <!-- Arch Frame -->
        <path d="M -140,-210 C -140,-260 140,-260 140,-210 L 140,240 L -140,240 Z" fill="${PALETTE.bg}" stroke="${primaryColor}" stroke-width="3"/>
        <!-- Gown -->
        <path d="M -120,240 Q -130,80 0,80 Q 130,80 120,240 Z" fill="${secondaryColor}" stroke="${PALETTE.blackMain}" stroke-width="4"/>
        <path d="M -50,90 L 50,90 L 70,240 L -70,240 Z" fill="${robeColor}" stroke="${PALETTE.blackMain}" stroke-width="3"/>
        <!-- Hair -->
        <path d="M -55,-40 C -70,50 -40,110 -35,120 C 0,80 35,120 40,110 C 70,50 55,-40 0,-70 Z" fill="#8B4513"/>
        <!-- Face -->
        <ellipse cx="0" cy="-10" rx="40" ry="46" fill="#FCE8D4" stroke="${PALETTE.blackMain}" stroke-width="2.5"/>
        <circle cx="-14" cy="-14" r="3.5" fill="${PALETTE.blackMain}"/>
        <circle cx="14" cy="-14" r="3.5" fill="${PALETTE.blackMain}"/>
        <path d="M -10,12 Q 0,20 10,12" fill="none" stroke="${PALETTE.redMain}" stroke-width="3" stroke-linecap="round"/>
        <!-- Tiara / Crown -->
        <path d="M -35,-48 L -35,-80 L -18,-60 L 0,-88 L 18,-60 L 35,-80 L 35,-48 Z" fill="${PALETTE.gold}" stroke="${PALETTE.blackMain}" stroke-width="3"/>
        <circle cx="0" cy="-64" r="4.5" fill="${isRed ? PALETTE.redMain : PALETTE.teal}"/>
        <!-- Flower Scepter -->
        <g transform="translate(-90, 50)">
          <line x1="0" y1="-160" x2="0" y2="120" stroke="#3A5A40" stroke-width="6" stroke-linecap="round"/>
          ${renderPip(suit, 0, -170, 0.65)}
        </g>
      </g>
    `;
  }

  // Jack
  return `
    <!-- Jack Illustration -->
    <g transform="translate(300, 450)">
      <!-- Arch Frame -->
      <path d="M -140,-210 C -140,-260 140,-260 140,-210 L 140,240 L -140,240 Z" fill="${PALETTE.bg}" stroke="${primaryColor}" stroke-width="3"/>
      <!-- Adventure Jacket / Tunic -->
      <path d="M -115,240 Q -125,90 0,90 Q 125,90 115,240 Z" fill="${robeColor}" stroke="${PALETTE.blackMain}" stroke-width="4"/>
      <!-- Patterned Sweater Inset -->
      <path d="M -50,100 L 50,100 L 65,240 L -65,240 Z" fill="${PALETTE.gold}" stroke="${PALETTE.blackMain}" stroke-width="3"/>
      <!-- Young Boy Head -->
      <ellipse cx="0" cy="-10" rx="42" ry="46" fill="#FCE8D4" stroke="${PALETTE.blackMain}" stroke-width="3"/>
      <!-- Cheerful Face -->
      <circle cx="-14" cy="-14" r="4" fill="${PALETTE.blackMain}"/>
      <circle cx="14" cy="-14" r="4" fill="${PALETTE.blackMain}"/>
      <circle cx="-24" cy="-2" r="6" fill="#F8B195" opacity="0.6"/>
      <circle cx="24" cy="-2" r="6" fill="#F8B195" opacity="0.6"/>
      <path d="M -14,14 Q 0,26 14,14" fill="none" stroke="${PALETTE.blackMain}" stroke-width="3.5" stroke-linecap="round"/>
      <!-- Knit Beanie with Feather -->
      <path d="M -46,-20 C -48,-80 48,-80 46,-20 Z" fill="${PALETTE.teal}" stroke="${PALETTE.blackMain}" stroke-width="3"/>
      <!-- Feather -->
      <path d="M 28,-60 C 50,-95 75,-90 60,-65 C 50,-55 35,-55 28,-60 Z" fill="${PALETTE.coral}" stroke="${PALETTE.blackMain}" stroke-width="2.5"/>
      <!-- Adventure Staff -->
      <g transform="translate(-95, 60)">
        <line x1="0" y1="-180" x2="0" y2="130" stroke="#6F4E37" stroke-width="7" stroke-linecap="round"/>
        ${renderPip(suit, 0, -190, 0.65)}
      </g>
    </g>
  `;
}

// Number Card Pip Layouts (2 through 10)
function renderNumberCardPips(suit, rank) {
  const pips = [];
  const flourishes = [];

  const colL = 205;
  const colC = 300;
  const colR = 395;

  switch (rank) {
    case 2:
      pips.push(renderPip(suit, colC, 310, 1.25, false));
      pips.push(renderPip(suit, colC, 590, 1.25, true));
      flourishes.push(renderFlourish(colC, 450));
      break;

    case 3:
      pips.push(renderPip(suit, colC, 270, 1.15, false));
      pips.push(renderPip(suit, colC, 450, 1.15, false));
      pips.push(renderPip(suit, colC, 630, 1.15, true));
      break;

    case 4:
      pips.push(renderPip(suit, colL, 290, 1.15, false));
      pips.push(renderPip(suit, colR, 290, 1.15, false));
      pips.push(renderPip(suit, colL, 610, 1.15, true));
      pips.push(renderPip(suit, colR, 610, 1.15, true));
      flourishes.push(renderFlourish(colC, 450));
      break;

    case 5:
      pips.push(renderPip(suit, colL, 280, 1.05, false));
      pips.push(renderPip(suit, colR, 280, 1.05, false));
      pips.push(renderPip(suit, colC, 450, 1.15, false));
      pips.push(renderPip(suit, colL, 620, 1.05, true));
      pips.push(renderPip(suit, colR, 620, 1.05, true));
      break;

    case 6:
      pips.push(renderPip(suit, colL, 270, 1.05, false));
      pips.push(renderPip(suit, colR, 270, 1.05, false));
      pips.push(renderPip(suit, colL, 450, 1.05, false));
      pips.push(renderPip(suit, colR, 450, 1.05, false));
      pips.push(renderPip(suit, colL, 630, 1.05, true));
      pips.push(renderPip(suit, colR, 630, 1.05, true));
      break;

    case 7:
      pips.push(renderPip(suit, colL, 260, 1.0, false));
      pips.push(renderPip(suit, colR, 260, 1.0, false));
      pips.push(renderPip(suit, colC, 355, 1.0, false));
      pips.push(renderPip(suit, colL, 450, 1.0, false));
      pips.push(renderPip(suit, colR, 450, 1.0, false));
      pips.push(renderPip(suit, colL, 640, 1.0, true));
      pips.push(renderPip(suit, colR, 640, 1.0, true));
      break;

    case 8:
      pips.push(renderPip(suit, colL, 260, 1.0, false));
      pips.push(renderPip(suit, colR, 260, 1.0, false));
      pips.push(renderPip(suit, colC, 355, 1.0, false));
      pips.push(renderPip(suit, colL, 450, 1.0, false));
      pips.push(renderPip(suit, colR, 450, 1.0, false));
      pips.push(renderPip(suit, colC, 545, 1.0, true));
      pips.push(renderPip(suit, colL, 640, 1.0, true));
      pips.push(renderPip(suit, colR, 640, 1.0, true));
      break;

    case 9:
      pips.push(renderPip(suit, colL, 250, 0.95, false));
      pips.push(renderPip(suit, colR, 250, 0.95, false));
      pips.push(renderPip(suit, colL, 380, 0.95, false));
      pips.push(renderPip(suit, colR, 380, 0.95, false));
      pips.push(renderPip(suit, colC, 450, 1.05, false));
      pips.push(renderPip(suit, colL, 520, 0.95, true));
      pips.push(renderPip(suit, colR, 520, 0.95, true));
      pips.push(renderPip(suit, colL, 650, 0.95, true));
      pips.push(renderPip(suit, colR, 650, 0.95, true));
      break;

    case 10:
      pips.push(renderPip(suit, colL, 250, 0.95, false));
      pips.push(renderPip(suit, colR, 250, 0.95, false));
      pips.push(renderPip(suit, colC, 315, 0.95, false));
      pips.push(renderPip(suit, colL, 380, 0.95, false));
      pips.push(renderPip(suit, colR, 380, 0.95, false));
      pips.push(renderPip(suit, colL, 520, 0.95, true));
      pips.push(renderPip(suit, colR, 520, 0.95, true));
      pips.push(renderPip(suit, colC, 585, 0.95, true));
      pips.push(renderPip(suit, colL, 650, 0.95, true));
      pips.push(renderPip(suit, colR, 650, 0.95, true));
      flourishes.push(renderFlourish(colC, 450));
      break;
  }

  return pips.join('\n') + '\n' + flourishes.join('\n');
}

// Generate Complete SVG for a Card
function generateCardSVG(suit, rank) {
  const isRed = suit === 'HEARTS' || suit === 'DIAMONDS';
  const color = isRed ? PALETTE.redMain : PALETTE.blackMain;
  const frameColor = isRed ? PALETTE.redMain : PALETTE.blackMain;

  let rankStr = String(rank);
  if (rank === 14) rankStr = 'A';
  if (rank === 11) rankStr = 'J';
  if (rank === 12) rankStr = 'Q';
  if (rank === 13) rankStr = 'K';

  let centerContent = '';
  if (rank === 14) {
    centerContent = renderAceCenterpiece(suit);
  } else if (rank >= 11 && rank <= 13) {
    centerContent = renderCourtCenterpiece(suit, rankStr);
  } else {
    centerContent = renderNumberCardPips(suit, rank);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${PALETTE.bg}"/>
      <stop offset="100%" stop-color="${PALETTE.bgGradientEnd}"/>
    </linearGradient>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Card Body -->
  <rect x="20" y="20" width="560" height="860" rx="34" fill="url(#bgGrad)" stroke="${PALETTE.cardBorder}" stroke-width="3" filter="url(#cardShadow)"/>

  <!-- Ornate Corner Frame Lines -->
  <!-- Top-Right Frame -->
  <path d="M 430,70 L 520,70 C 526,70 530,74 530,80 L 530,170" fill="none" stroke="${frameColor}" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="530" cy="70" r="4.5" fill="${frameColor}"/>
  <!-- Bottom-Left Frame -->
  <path d="M 170,830 L 80,830 C 74,830 70,826 70,820 L 70,730" fill="none" stroke="${frameColor}" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="70" cy="830" r="4.5" fill="${frameColor}"/>

  <!-- Top-Left Corner Index -->
  <g transform="translate(68, 60)">
    <text x="0" y="55" font-family="'system-ui', -apple-system, 'Georgia', serif" font-weight="900" font-size="${rankStr === '10' ? '54' : '62'}" fill="${color}" text-anchor="middle">${rankStr}</text>
    ${renderPip(suit, 0, 95, 0.42)}
  </g>

  <!-- Bottom-Right Corner Index (Inverted) -->
  <g transform="translate(532, 840) rotate(180)">
    <text x="0" y="55" font-family="'system-ui', -apple-system, 'Georgia', serif" font-weight="900" font-size="${rankStr === '10' ? '54' : '62'}" fill="${color}" text-anchor="middle">${rankStr}</text>
    ${renderPip(suit, 0, 95, 0.42)}
  </g>

  <!-- Center Artwork -->
  ${centerContent}
</svg>`;
}

// Generate the full 52 cards
const suits = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

let generatedCount = 0;

for (const suit of suits) {
  for (const rank of ranks) {
    const suitName = suit.toLowerCase();
    let rankStr = String(rank);
    if (rank === 14) rankStr = 'A';
    if (rank === 11) rankStr = 'J';
    if (rank === 12) rankStr = 'Q';
    if (rank === 13) rankStr = 'K';

    const svgContent = generateCardSVG(suit, rank);

    // Save with rank letter/number (e.g., spades_A.svg, spades_10.svg)
    const file1 = path.join(CARDS_DIR, `${suitName}_${rankStr}.svg`);
    fs.writeFileSync(file1, svgContent, 'utf-8');

    // Also save with numeric rank (e.g., spades_14.svg)
    const file2 = path.join(CARDS_DIR, `${suitName}_${rank}.svg`);
    fs.writeFileSync(file2, svgContent, 'utf-8');

    generatedCount++;
  }
}

console.log(`Generated ${generatedCount} card SVGs in ${CARDS_DIR}`);
