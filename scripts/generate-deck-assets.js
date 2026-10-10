import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CARDS_DIR = path.resolve(__dirname, '../public/cards');

const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
for (const suit of SUITS) {
  const suitDir = path.join(CARDS_DIR, suit);
  if (!fs.existsSync(suitDir)) {
    fs.mkdirSync(suitDir, { recursive: true });
  }
}

// Color palettes matching the authentic botanical folk-art reference style
const PALETTE = {
  bg: '#FAF6EE',
  bgEnd: '#F5EFE2',
  cardBorder: '#DDD4C0',
  blackMain: '#1A2438',
  blackAccent: '#2D3E5E',
  redMain: '#D03D32',
  redAccent: '#EE7D68',
  redDark: '#96241C',
  gold: '#D6A449',
  goldLight: '#F4C458',
  teal: '#2E7E7A',
  tealLight: '#479B98',
  inkDark: '#1C1414',
};

// Ornate Folk-Art Spade Pip
export function getSpadePip(x, y, s = 1, flipped = false) {
  const transform = `translate(${x}, ${y}) scale(${s}) ${flipped ? 'rotate(180)' : ''}`;
  return `
    <g transform="${transform}">
      <!-- Outer Spade Body -->
      <path d="M 0,-54 C -26,-22 -52,8 -52,28 C -52,48 -34,54 -16,50 C -4,46 0,32 0,32 C 0,32 4,46 16,50 C 34,54 52,48 52,28 C 52,8 26,-22 0,-54 Z" 
            fill="${PALETTE.blackMain}" stroke="${PALETTE.inkDark}" stroke-width="4.5" stroke-linejoin="round"/>
      <!-- Flared Stem -->
      <path d="M -9,34 Q -9,58 -24,66 L 24,66 Q 9,58 9,34 Z" fill="${PALETTE.blackMain}" stroke="${PALETTE.inkDark}" stroke-width="3.5" stroke-linejoin="round"/>
      <!-- Botanical Insets -->
      <path d="M 0,-38 Q -14,-10 -8,22 Q 0,10 0,-38 Z" fill="${PALETTE.teal}" stroke="${PALETTE.inkDark}" stroke-width="2"/>
      <path d="M 0,-38 Q 14,-10 8,22 Q 0,10 0,-38 Z" fill="${PALETTE.teal}" stroke="${PALETTE.inkDark}" stroke-width="2"/>
      <path d="M -20,6 Q -34,22 -22,34 Q -10,26 -20,6 Z" fill="${PALETTE.gold}" stroke="${PALETTE.inkDark}" stroke-width="2"/>
      <path d="M 20,6 Q 34,22 22,34 Q 10,26 20,6 Z" fill="${PALETTE.gold}" stroke="${PALETTE.inkDark}" stroke-width="2"/>
      <circle cx="0" cy="4" r="4.5" fill="${PALETTE.goldLight}"/>
      <circle cx="-16" cy="30" r="2.5" fill="${PALETTE.tealLight}"/>
      <circle cx="16" cy="30" r="2.5" fill="${PALETTE.tealLight}"/>
    </g>
  `;
}

// Ornate Folk-Art Heart Pip (Tulip / botanical vines)
export function getHeartPip(x, y, s = 1, flipped = false) {
  const transform = `translate(${x}, ${y}) scale(${s}) ${flipped ? 'rotate(180)' : ''}`;
  return `
    <g transform="${transform}">
      <!-- Outer Heart Base with bold outline -->
      <path d="M 0,52 C -5,48 -54,16 -54,-18 C -54,-42 -30,-56 0,-32 C 30,-56 54,-42 54,-18 C 54,16 5,48 0,52 Z"
            fill="${PALETTE.redMain}" stroke="${PALETTE.inkDark}" stroke-width="4.5" stroke-linejoin="round"/>
      <!-- Inner heart shadow line -->
      <path d="M 0,42 C -4,38 -44,12 -44,-16 C -44,-36 -24,-46 0,-26 C 24,-46 44,-36 44,-16 C 44,12 4,38 0,42 Z"
            fill="${PALETTE.redDark}" stroke="${PALETTE.goldLight}" stroke-width="2" opacity="0.5"/>
      <!-- Central folk-art tulip blossom -->
      <path d="M 0,-14 C -16,-28 -32,-10 -20,12 C -10,6 -5,-4 0,-14 Z" fill="${PALETTE.redAccent}" stroke="${PALETTE.inkDark}" stroke-width="2.5"/>
      <path d="M 0,-14 C 16,-28 32,-10 20,12 C 10,6 5,-4 0,-14 Z" fill="${PALETTE.redAccent}" stroke="${PALETTE.inkDark}" stroke-width="2.5"/>
      <path d="M 0,-2 C -10,18 0,36 0,36 C 0,36 10,18 0,-2 Z" fill="${PALETTE.goldLight}" stroke="${PALETTE.inkDark}" stroke-width="2.5"/>
      <!-- Teal leaves -->
      <path d="M -22,-2 C -34,-14 -32,2 -16,8 Z" fill="${PALETTE.teal}" stroke="${PALETTE.inkDark}" stroke-width="2"/>
      <path d="M 22,-2 C 34,-14 32,2 16,8 Z" fill="${PALETTE.teal}" stroke="${PALETTE.inkDark}" stroke-width="2"/>
      <circle cx="0" cy="-2" r="4.5" fill="#FAF5E8" stroke="${PALETTE.inkDark}" stroke-width="2"/>
      <circle cx="-18" cy="-18" r="3" fill="${PALETTE.goldLight}"/>
      <circle cx="18" cy="-18" r="3" fill="${PALETTE.goldLight}"/>
    </g>
  `;
}

// Ornate Folk-Art Club Pip (Trefoil with foliage)
export function getClubPip(x, y, s = 1, flipped = false) {
  const transform = `translate(${x}, ${y}) scale(${s}) ${flipped ? 'rotate(180)' : ''}`;
  return `
    <g transform="${transform}">
      <!-- Outer Trefoil Lobes with heavy ink outline -->
      <circle cx="0" cy="-28" r="26" fill="${PALETTE.blackMain}" stroke="${PALETTE.inkDark}" stroke-width="4.5"/>
      <circle cx="-28" cy="10" r="26" fill="${PALETTE.blackMain}" stroke="${PALETTE.inkDark}" stroke-width="4.5"/>
      <circle cx="28" cy="10" r="26" fill="${PALETTE.blackMain}" stroke="${PALETTE.inkDark}" stroke-width="4.5"/>
      <circle cx="0" cy="-2" r="20" fill="${PALETTE.blackMain}"/>
      <!-- Flared Stem -->
      <path d="M -10,14 Q -10,54 -24,62 L 24,62 Q 10,54 10,14 Z" fill="${PALETTE.blackMain}" stroke="${PALETTE.inkDark}" stroke-width="3.5" stroke-linejoin="round"/>
      <!-- Botanical Foliage Inset -->
      <path d="M 0,-44 Q -10,-28 0,-16 Q 10,-28 0,-44 Z" fill="${PALETTE.teal}" stroke="${PALETTE.inkDark}" stroke-width="2"/>
      <path d="M -36,8 Q -22,0 -14,14 Q -26,22 -36,8 Z" fill="${PALETTE.gold}" stroke="${PALETTE.inkDark}" stroke-width="2"/>
      <path d="M 36,8 Q 22,0 14,14 Q 26,22 36,8 Z" fill="${PALETTE.gold}" stroke="${PALETTE.inkDark}" stroke-width="2"/>
      <circle cx="0" cy="-2" r="4.5" fill="${PALETTE.goldLight}"/>
    </g>
  `;
}

// Ornate Folk-Art Diamond Pip (Faceted gemstone)
export function getDiamondPip(x, y, s = 1, flipped = false) {
  const transform = `translate(${x}, ${y}) scale(${s}) ${flipped ? 'rotate(180)' : ''}`;
  return `
    <g transform="${transform}">
      <!-- Outer Diamond Body -->
      <path d="M 0,-56 L 46,0 L 0,56 L -46,0 Z" 
            fill="${PALETTE.redMain}" stroke="${PALETTE.inkDark}" stroke-width="4.5" stroke-linejoin="round"/>
      <!-- Inner faceted gem -->
      <path d="M 0,-40 L 30,0 L 0,40 L -30,0 Z" fill="${PALETTE.redAccent}" stroke="${PALETTE.inkDark}" stroke-width="2.5"/>
      <path d="M 0,-24 L 18,0 L 0,24 L -18,0 Z" fill="${PALETTE.gold}" stroke="${PALETTE.inkDark}" stroke-width="2"/>
      <circle cx="0" cy="0" r="4.5" fill="${PALETTE.goldLight}"/>
      <circle cx="0" cy="-40" r="3" fill="${PALETTE.tealLight}"/>
      <circle cx="0" cy="40" r="3" fill="${PALETTE.tealLight}"/>
    </g>
  `;
}

export function renderPip(suit, x, y, s = 1, flipped = false) {
  const sUpper = suit.toUpperCase();
  if (sUpper === 'SPADES') return getSpadePip(x, y, s, flipped);
  if (sUpper === 'HEARTS') return getHeartPip(x, y, s, flipped);
  if (sUpper === 'CLUBS') return getClubPip(x, y, s, flipped);
  if (sUpper === 'DIAMONDS') return getDiamondPip(x, y, s, flipped);
  return '';
}

// Swirling Vine Flourish between pips (matches reference 10 of hearts)
export function renderFlourish(x, y, s = 1, flipped = false) {
  return `
    <g transform="translate(${x}, ${y}) scale(${s}) ${flipped ? 'rotate(180)' : ''}">
      <path d="M -40,-8 C -20,-24 -5,-12 0,0 C 5,-12 20,-24 40,-8" fill="none" stroke="${PALETTE.tealLight}" stroke-width="3" stroke-linecap="round"/>
      <path d="M -30,6 C -15,16 0,10 0,0 C 0,10 15,16 30,6" fill="none" stroke="${PALETTE.redAccent}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 0,-12 L 0,-22 M -6,-17 L 6,-17" stroke="${PALETTE.gold}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="-42" cy="-6" r="3" fill="${PALETTE.tealLight}"/>
      <circle cx="42" cy="-6" r="3" fill="${PALETTE.tealLight}"/>
      <circle cx="0" cy="18" r="3.5" fill="${PALETTE.redMain}"/>
    </g>
  `;
}

// Layout pips for number cards (2..10)
export function renderNumberCardPips(suit, rank) {
  const pips = [];
  const flourishes = [];

  const colL = 220;
  const colC = 300;
  const colR = 380;

  switch (rank) {
    case 2:
      pips.push(renderPip(suit, colC, 310, 1.25, false));
      pips.push(renderPip(suit, colC, 590, 1.25, true));
      flourishes.push(renderFlourish(colC, 450, 1.1));
      break;

    case 3:
      pips.push(renderPip(suit, colC, 270, 1.15, false));
      pips.push(renderPip(suit, colC, 450, 1.15, false));
      pips.push(renderPip(suit, colC, 630, 1.15, true));
      flourishes.push(renderFlourish(colC, 360, 0.8));
      flourishes.push(renderFlourish(colC, 540, 0.8, true));
      break;

    case 4:
      pips.push(renderPip(suit, colL, 290, 1.15, false));
      pips.push(renderPip(suit, colR, 290, 1.15, false));
      pips.push(renderPip(suit, colL, 610, 1.15, true));
      pips.push(renderPip(suit, colR, 610, 1.15, true));
      flourishes.push(renderFlourish(colC, 450, 1.2));
      break;

    case 5:
      pips.push(renderPip(suit, colL, 280, 1.05, false));
      pips.push(renderPip(suit, colR, 280, 1.05, false));
      pips.push(renderPip(suit, colC, 450, 1.15, false));
      pips.push(renderPip(suit, colL, 620, 1.05, true));
      pips.push(renderPip(suit, colR, 620, 1.05, true));
      flourishes.push(renderFlourish(colC, 365, 0.85));
      flourishes.push(renderFlourish(colC, 535, 0.85, true));
      break;

    case 6:
      pips.push(renderPip(suit, colL, 270, 1.05, false));
      pips.push(renderPip(suit, colR, 270, 1.05, false));
      pips.push(renderPip(suit, colL, 450, 1.05, false));
      pips.push(renderPip(suit, colR, 450, 1.05, false));
      pips.push(renderPip(suit, colL, 630, 1.05, true));
      pips.push(renderPip(suit, colR, 630, 1.05, true));
      flourishes.push(renderFlourish(colC, 360, 0.9));
      flourishes.push(renderFlourish(colC, 540, 0.9, true));
      break;

    case 7:
      pips.push(renderPip(suit, colL, 260, 1.0, false));
      pips.push(renderPip(suit, colR, 260, 1.0, false));
      pips.push(renderPip(suit, colC, 355, 1.0, false));
      pips.push(renderPip(suit, colL, 450, 1.0, false));
      pips.push(renderPip(suit, colR, 450, 1.0, false));
      pips.push(renderPip(suit, colL, 640, 1.0, true));
      pips.push(renderPip(suit, colR, 640, 1.0, true));
      flourishes.push(renderFlourish(colC, 545, 0.9, true));
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
      pips.push(renderPip(suit, 215, 230, 0.88, false));
      pips.push(renderPip(suit, 385, 230, 0.88, false));
      pips.push(renderPip(suit, colC, 310, 0.88, false));
      pips.push(renderPip(suit, 215, 395, 0.88, false));
      pips.push(renderPip(suit, 385, 395, 0.88, false));
      flourishes.push(renderFlourish(colC, 450, 1.1));
      pips.push(renderPip(suit, 215, 505, 0.88, true));
      pips.push(renderPip(suit, 385, 505, 0.88, true));
      pips.push(renderPip(suit, colC, 590, 0.88, true));
      pips.push(renderPip(suit, 215, 670, 0.88, true));
      pips.push(renderPip(suit, 385, 670, 0.88, true));
      break;
  }

  return pips.join('\n') + '\n' + flourishes.join('\n');
}

// Generate Complete SVG for a Card
export function generateCardSVG(suit, rank) {
  const isRed = suit.toUpperCase() === 'HEARTS' || suit.toUpperCase() === 'DIAMONDS';
  const color = isRed ? PALETTE.redMain : PALETTE.blackMain;
  const accent = isRed ? PALETTE.tealLight : PALETTE.gold;

  const rankStr = String(rank);
  const underline6or9 = (rank === 6 || rank === 9)
    ? `<line x1="-18" y1="63" x2="18" y2="63" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${PALETTE.bg}"/>
      <stop offset="100%" stop-color="${PALETTE.bgEnd}"/>
    </linearGradient>
  </defs>

  <!-- Card Body with rounded corners (No outer drop-shadow box so background is transparent) -->
  <rect x="0" y="0" width="600" height="900" rx="36" fill="url(#bgGrad)" stroke="${PALETTE.cardBorder}" stroke-width="3"/>

  <!-- Ornate Double-Line Corner Frames -->
  <!-- Top-Right Frame -->
  <path d="M 440,70 L 524,70 C 530,70 534,74 534,80 L 534,164" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
  <path d="M 470,84 L 520,84 C 522,84 524,86 524,88 L 524,138" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
  ${renderPip(suit, 534, 70, 0.22)}

  <!-- Bottom-Left Frame -->
  <path d="M 160,830 L 76,830 C 70,830 66,826 66,820 L 66,736" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
  <path d="M 130,816 L 80,816 C 78,816 76,814 76,812 L 76,762" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
  ${renderPip(suit, 66, 830, 0.22, true)}

  <!-- Top-Left Corner Index -->
  <g transform="translate(68, 62)">
    <text x="0" y="52" font-family="-apple-system, system-ui, 'Georgia', serif" font-weight="900" font-size="${rankStr === '10' ? '54' : '62'}" fill="${color}" text-anchor="middle">${rankStr}</text>
    ${underline6or9}
    ${renderPip(suit, 0, 96, 0.38)}
  </g>

  <!-- Bottom-Right Corner Index (Inverted) -->
  <g transform="translate(532, 838) rotate(180)">
    <text x="0" y="52" font-family="-apple-system, system-ui, 'Georgia', serif" font-weight="900" font-size="${rankStr === '10' ? '54' : '62'}" fill="${color}" text-anchor="middle">${rankStr}</text>
    ${underline6or9}
    ${renderPip(suit, 0, 96, 0.38)}
  </g>

  <!-- Center Botanical Artwork -->
  ${renderNumberCardPips(suit, rank)}
</svg>`;
}

// Generate all number card SVGs for all 4 suits
const suits = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10];

let count = 0;
for (const suit of suits) {
  const suitDir = path.join(CARDS_DIR, suit);
  const suitLower = suit.toLowerCase();
  for (const rank of ranks) {
    const svg = generateCardSVG(suit, rank);
    
    // Save as <rank>.svg in suit folder
    fs.writeFileSync(path.join(suitDir, `${rank}.svg`), svg, 'utf-8');
    // Save as <suit>_<rank>.svg in suit folder
    fs.writeFileSync(path.join(suitDir, `${suitLower}_${rank}.svg`), svg, 'utf-8');
    // Save in root cards dir for fallback
    fs.writeFileSync(path.join(CARDS_DIR, `${suitLower}_${rank}.svg`), svg, 'utf-8');
    count++;
  }
}

console.log(`Generated ${count} number card SVGs across all suit directories.`);
