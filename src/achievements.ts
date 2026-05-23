// Neon Pinball VR - Achievement System
// Round 3: Track player accomplishments with persistent storage

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;       // emoji
  color: string;      // neon color
  unlocked: boolean;
  unlockedDate: string | null;
}

export interface GameStats {
  totalGames: number;
  totalScore: number;
  bestScore: number;
  bestCombo: number;
  totalBumperHits: number;
  totalRampShots: number;
  totalMultiballs: number;
  totalMissionsCompleted: number;
  totalWizardModes: number;
  totalExtraBalls: number;
  totalPlayTimeSeconds: number;
}

const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked' | 'unlockedDate'>[] = [
  { id: 'first_game', name: 'FIRST TILT', description: 'Play your first game', icon: '🎮', color: '#00ffff' },
  { id: 'score_100k', name: 'SIX FIGURES', description: 'Score 100,000 points', icon: '💯', color: '#ffff00' },
  { id: 'score_500k', name: 'HALF MILLION', description: 'Score 500,000 points', icon: '💎', color: '#ff00ff' },
  { id: 'score_1m', name: 'MILLIONAIRE', description: 'Score 1,000,000 points', icon: '👑', color: '#ff8800' },
  { id: 'combo_5x', name: 'COMBO STARTER', description: 'Reach a 5x combo', icon: '⚡', color: '#00ff88' },
  { id: 'combo_10x', name: 'COMBO KING', description: 'Reach the max 10x multiplier', icon: '🔥', color: '#ff4400' },
  { id: 'first_multiball', name: 'MULTI MAYHEM', description: 'Trigger multiball', icon: '🎱', color: '#4488ff' },
  { id: 'first_mission', name: 'MISSION ACCEPTED', description: 'Complete a mission', icon: '🎯', color: '#00ff88' },
  { id: 'all_missions', name: 'MISSION MASTER', description: 'Complete all 5 mission types', icon: '🏆', color: '#ffff00' },
  { id: 'wizard_mode', name: 'WIZARD!', description: 'Activate Wizard Mode', icon: '🧙', color: '#ff00ff' },
  { id: 'ramp_combo_5', name: 'RAMP RUNNER', description: 'Hit 5 ramp combos in a row', icon: '🎢', color: '#ff00ff' },
  { id: 'super_ramp', name: 'SUPER RAMP', description: 'Trigger a Super Ramp bonus', icon: '🚀', color: '#00ffff' },
  { id: 'jackpot_3', name: 'JACKPOT HUNTER', description: 'Hit 3 jackpots in one game', icon: '💰', color: '#ffff00' },
  { id: 'no_drain', name: 'STEEL NERVES', description: 'Score 50,000 on ball 1', icon: '🛡️', color: '#00ff88' },
  { id: 'extra_ball', name: 'EXTRA! EXTRA!', description: 'Earn your first extra ball', icon: '🌟', color: '#ff8800' },
  { id: 'bumper_100', name: 'BUMPER BASH', description: 'Hit bumpers 100 times in one game', icon: '💥', color: '#ff4400' },
];

export class AchievementManager {
  achievements: Achievement[] = [];
  stats: GameStats;
  private unlockCallbacks: ((achievement: Achievement) => void)[] = [];

  // Tracking per-game
  jackpotsThisGame = 0;
  missionsCompletedTypes = new Set<string>();
  gameStartTime = 0;

  constructor() {
    this.stats = this.loadStats();
    this.achievements = this.loadAchievements();
  }

  onUnlock(cb: (achievement: Achievement) => void): void {
    this.unlockCallbacks.push(cb);
  }

  startGame(): void {
    this.jackpotsThisGame = 0;
    this.missionsCompletedTypes.clear();
    this.gameStartTime = Date.now();
    this.stats.totalGames++;
    this.unlock('first_game');
  }

  endGame(score: number, bumperHits: number, maxMultiplier: number): void {
    const playTime = (Date.now() - this.gameStartTime) / 1000;
    this.stats.totalPlayTimeSeconds += playTime;
    this.stats.totalScore += score;
    if (score > this.stats.bestScore) this.stats.bestScore = score;
    this.stats.totalBumperHits += bumperHits;

    // Check score achievements
    if (score >= 100000) this.unlock('score_100k');
    if (score >= 500000) this.unlock('score_500k');
    if (score >= 1000000) this.unlock('score_1m');

    // Bumper achievement
    if (bumperHits >= 100) this.unlock('bumper_100');

    this.saveStats();
    this.saveAchievements();
  }

  checkCombo(multiplier: number): void {
    if (multiplier > this.stats.bestCombo) this.stats.bestCombo = multiplier;
    if (multiplier >= 3.5) this.unlock('combo_5x');   // 5 combos = 1 + 4*0.5 = 3.0, but being generous
    if (multiplier >= 5.5) this.unlock('combo_10x');
  }

  checkMultiball(): void {
    this.stats.totalMultiballs++;
    this.unlock('first_multiball');
  }

  checkMissionComplete(missionType: string): void {
    this.stats.totalMissionsCompleted++;
    this.unlock('first_mission');
    this.missionsCompletedTypes.add(missionType);
    if (this.missionsCompletedTypes.size >= 5) {
      this.unlock('all_missions');
    }
  }

  checkWizardMode(): void {
    this.stats.totalWizardModes++;
    this.unlock('wizard_mode');
  }

  checkRampCombo(comboCount: number): void {
    this.stats.totalRampShots++;
    if (comboCount >= 5) this.unlock('ramp_combo_5');
  }

  checkSuperRamp(): void {
    this.unlock('super_ramp');
  }

  checkJackpot(): void {
    this.jackpotsThisGame++;
    if (this.jackpotsThisGame >= 3) this.unlock('jackpot_3');
  }

  checkBallOneScore(score: number, currentBall: number): void {
    if (currentBall === 1 && score >= 50000) {
      this.unlock('no_drain');
    }
  }

  checkExtraBall(): void {
    this.stats.totalExtraBalls++;
    this.unlock('extra_ball');
  }

  private unlock(id: string): void {
    const ach = this.achievements.find(a => a.id === id);
    if (!ach || ach.unlocked) return;
    ach.unlocked = true;
    ach.unlockedDate = new Date().toISOString();
    this.saveAchievements();
    for (const cb of this.unlockCallbacks) cb(ach);
  }

  getUnlockedCount(): number {
    return this.achievements.filter(a => a.unlocked).length;
  }

  getTotalCount(): number {
    return this.achievements.length;
  }

  // Persistence
  private loadAchievements(): Achievement[] {
    try {
      const raw = localStorage.getItem('neon-pinball-achievements');
      if (raw) {
        const saved: Achievement[] = JSON.parse(raw);
        // Merge with defs (add new achievements)
        return ACHIEVEMENT_DEFS.map(def => {
          const existing = saved.find(s => s.id === def.id);
          return existing || { ...def, unlocked: false, unlockedDate: null };
        });
      }
    } catch {}
    return ACHIEVEMENT_DEFS.map(def => ({ ...def, unlocked: false, unlockedDate: null }));
  }

  private saveAchievements(): void {
    try {
      localStorage.setItem('neon-pinball-achievements', JSON.stringify(this.achievements));
    } catch {}
  }

  private loadStats(): GameStats {
    try {
      const raw = localStorage.getItem('neon-pinball-stats');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      totalGames: 0, totalScore: 0, bestScore: 0, bestCombo: 0,
      totalBumperHits: 0, totalRampShots: 0, totalMultiballs: 0,
      totalMissionsCompleted: 0, totalWizardModes: 0, totalExtraBalls: 0,
      totalPlayTimeSeconds: 0,
    };
  }

  private saveStats(): void {
    try {
      localStorage.setItem('neon-pinball-stats', JSON.stringify(this.stats));
    } catch {}
  }
}
