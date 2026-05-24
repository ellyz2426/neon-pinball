// Neon Pinball VR - Table Themes
// Round 5: Selectable color themes for the table

export interface TableTheme {
  id: string;
  name: string;
  // Playfield
  playfieldColor: number;
  // Rails and borders
  railColor: number;
  railEmissive: number;
  // Bumpers
  bumperColors: number[];
  // Flipper
  flipperColor: number;
  flipperEmissive: number;
  // Ball
  ballEmissive: number;
  ballGlow: number;
  // Slingshot
  slingshotColor: number;
  // Accent colors for UI border and lights
  accentPrimary: number;
  accentSecondary: number;
  // Environment
  fogColor: number;
  gridColor: number;
  ambientLight: number;
  // Table lights
  mainLightColor: number;
  leftLightColor: number;
  rightLightColor: number;
}

export const THEMES: TableTheme[] = [
  {
    id: 'neon-classic',
    name: 'NEON CLASSIC',
    playfieldColor: 0x050510,
    railColor: 0x00ffff,
    railEmissive: 0x00aaff,
    bumperColors: [0xff00ff, 0xff8800, 0x00ff88],
    flipperColor: 0x00ffff,
    flipperEmissive: 0x00aaff,
    ballEmissive: 0x00ffff,
    ballGlow: 0x00ffff,
    slingshotColor: 0xffff00,
    accentPrimary: 0x00ffff,
    accentSecondary: 0xff00ff,
    fogColor: 0x000510,
    gridColor: 0x001a33,
    ambientLight: 0x111122,
    mainLightColor: 0xffffff,
    leftLightColor: 0xff00ff,
    rightLightColor: 0x00ff88,
  },
  {
    id: 'cyber-red',
    name: 'CYBER RED',
    playfieldColor: 0x100505,
    railColor: 0xff2222,
    railEmissive: 0xff0000,
    bumperColors: [0xff4400, 0xffaa00, 0xff0066],
    flipperColor: 0xff4400,
    flipperEmissive: 0xff2200,
    ballEmissive: 0xff4400,
    ballGlow: 0xff2200,
    slingshotColor: 0xffaa00,
    accentPrimary: 0xff2222,
    accentSecondary: 0xff8800,
    fogColor: 0x100000,
    gridColor: 0x330000,
    ambientLight: 0x221111,
    mainLightColor: 0xffccaa,
    leftLightColor: 0xff4400,
    rightLightColor: 0xff0066,
  },
  {
    id: 'ocean-blue',
    name: 'OCEAN BLUE',
    playfieldColor: 0x050515,
    railColor: 0x0088ff,
    railEmissive: 0x0044ff,
    bumperColors: [0x00aaff, 0x0066ff, 0x00ffaa],
    flipperColor: 0x00aaff,
    flipperEmissive: 0x0066ff,
    ballEmissive: 0x00aaff,
    ballGlow: 0x0088ff,
    slingshotColor: 0x00ffaa,
    accentPrimary: 0x0088ff,
    accentSecondary: 0x00ffaa,
    fogColor: 0x000510,
    gridColor: 0x001133,
    ambientLight: 0x111133,
    mainLightColor: 0xccddff,
    leftLightColor: 0x0066ff,
    rightLightColor: 0x00ffaa,
  },
  {
    id: 'solar-flare',
    name: 'SOLAR FLARE',
    playfieldColor: 0x0f0800,
    railColor: 0xffaa00,
    railEmissive: 0xff6600,
    bumperColors: [0xff4400, 0xffcc00, 0xff8800],
    flipperColor: 0xffaa00,
    flipperEmissive: 0xff6600,
    ballEmissive: 0xffcc00,
    ballGlow: 0xffaa00,
    slingshotColor: 0xff4400,
    accentPrimary: 0xffaa00,
    accentSecondary: 0xff4400,
    fogColor: 0x0a0400,
    gridColor: 0x331a00,
    ambientLight: 0x221811,
    mainLightColor: 0xffddaa,
    leftLightColor: 0xff6600,
    rightLightColor: 0xffcc00,
  },
  {
    id: 'toxic-green',
    name: 'TOXIC GREEN',
    playfieldColor: 0x020a02,
    railColor: 0x00ff44,
    railEmissive: 0x00aa22,
    bumperColors: [0x44ff00, 0x00ff88, 0xaaff00],
    flipperColor: 0x00ff44,
    flipperEmissive: 0x00aa22,
    ballEmissive: 0x44ff00,
    ballGlow: 0x00ff44,
    slingshotColor: 0xaaff00,
    accentPrimary: 0x00ff44,
    accentSecondary: 0xaaff00,
    fogColor: 0x010500,
    gridColor: 0x003300,
    ambientLight: 0x112211,
    mainLightColor: 0xccffcc,
    leftLightColor: 0x44ff00,
    rightLightColor: 0x00ff88,
  },
];

export function getTheme(id: string): TableTheme {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

export function getDefaultTheme(): TableTheme {
  return THEMES[0];
}

// Daily challenge seeded PRNG
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Simple mulberry32 PRNG
  next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  // Get next integer in range [min, max]
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

export interface DailyChallenge {
  seed: number;
  dateStr: string;
  targetScore: number;
  modifiers: string[];
}

export function getDailySeed(): number {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const chr = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDailyChallenge(): DailyChallenge {
  const seed = getDailySeed();
  const rng = new SeededRandom(seed);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Generate a target score (par score) for today
  const targetScore = rng.nextInt(100000, 500000);

  // Generate modifiers for today's challenge
  const allModifiers = [
    'FAST BALL (1.3x speed)',
    'HEAVY BALL (more gravity)',
    'SLIPPERY (less friction)',
    'STRONG BUMPERS (1.5x kick)',
    'SHORT SAVER (5s ball saver)',
    'DOUBLE TARGETS (targets worth 2x)',
    'RAMP MASTER (ramps worth 3x)',
    'SPINNER CITY (spinners everywhere)',
  ];

  const modCount = rng.nextInt(1, 3);
  const modifiers: string[] = [];
  const used = new Set<number>();
  for (let i = 0; i < modCount; i++) {
    let idx: number;
    do { idx = rng.nextInt(0, allModifiers.length - 1); } while (used.has(idx));
    used.add(idx);
    modifiers.push(allModifiers[idx]);
  }

  return { seed, dateStr, targetScore, modifiers };
}

// Daily leaderboard persistence
export interface DailyScore {
  score: number;
  date: string;
}

export function saveDailyScore(score: number): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = 'neon-pinball-daily';
    const raw = localStorage.getItem(key);
    const data: DailyScore[] = raw ? JSON.parse(raw) : [];

    // Find today's entry
    const existing = data.find(d => d.date === today);
    if (existing) {
      if (score > existing.score) existing.score = score;
    } else {
      data.push({ score, date: today });
    }

    // Keep last 30 days
    data.sort((a, b) => b.date.localeCompare(a.date));
    localStorage.setItem(key, JSON.stringify(data.slice(0, 30)));
  } catch {}
}

export function getDailyBestScore(): number {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem('neon-pinball-daily');
    if (!raw) return 0;
    const data: DailyScore[] = JSON.parse(raw);
    const entry = data.find(d => d.date === today);
    return entry?.score || 0;
  } catch { return 0; }
}
