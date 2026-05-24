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
  // Round 4 achievements
  { id: 'skill_shot_perfect', name: 'SHARP SHOOTER', description: 'Land a Perfect skill shot', icon: '🎯', color: '#ff00ff' },
  { id: 'skill_shot_3', name: 'SKILL MASTER', description: 'Land 3 skill shots in one game', icon: '🎪', color: '#ffff00' },
  { id: 'super_jackpot', name: 'SUPER JACKPOT!', description: 'Hit the Super Jackpot', icon: '💎', color: '#ff00ff' },
  { id: 'captive_frenzy', name: 'CAPTIVE MANIAC', description: 'Hit the captive ball 10 times', icon: '🔮', color: '#4400ff' },
  { id: 'godlike_combo', name: 'GODLIKE', description: 'Reach GODLIKE combo tier', icon: '⚡', color: '#ff00ff' },
  { id: 'bonus_50k', name: 'BONUS BONANZA', description: 'Earn 50,000+ end-of-ball bonus', icon: '🎰', color: '#ffff00' },
  { id: 'games_10', name: 'REGULAR', description: 'Play 10 games', icon: '🏠', color: '#00ffff' },
  { id: 'games_50', name: 'ADDICT', description: 'Play 50 games', icon: '🔥', color: '#ff4400' },
  // Round 5 achievements
  { id: 'magna_save', name: 'MAGNETIC PULL', description: 'Use Magna-Save to save the ball', icon: '🧲', color: '#4488ff' },
  { id: 'all_themes', name: 'FASHIONISTA', description: 'Try all 5 table themes', icon: '🎨', color: '#ff00ff' },
  { id: 'daily_beat', name: 'DAILY CHAMPION', description: 'Beat a daily challenge target', icon: '📅', color: '#ffff00' },
  { id: 'score_2m', name: 'DOUBLE MILLIONAIRE', description: 'Score 2,000,000 points', icon: '💰', color: '#ff8800' },
  { id: 'time_attack_100k', name: 'SPEED DEMON', description: 'Score 100K in Time Attack', icon: '⏱️', color: '#ff4400' },
  { id: 'orbit_complete', name: 'ORBIT KING', description: 'Complete a full orbit shot', icon: '🌀', color: '#00ccff' },
  { id: 'orbit_3x', name: 'ORBITAL MADNESS', description: 'Hit 3 consecutive orbits', icon: '🌀', color: '#00ffff' },
  { id: 'frenzy_trigger', name: 'FRENZY!', description: 'Trigger Frenzy bonus round', icon: '🔥', color: '#ff6600' },
  { id: 'milestone_1m', name: 'MILESTONE MASTER', description: 'Reach the 1M score milestone', icon: '⭐', color: '#ffd700' },
  { id: 'score_5m', name: 'FIVE MILLION', description: 'Score 5,000,000 points', icon: '🏆', color: '#ffd700' },
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
    this.skillShotsThisGame = 0;
    this.captiveBallHitsThisGame = 0;
    this.gameStartTime = Date.now();
    this.stats.totalGames++;
    this.unlock('first_game');
    this.checkGamesPlayed();
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
    if (score >= 2000000) this.unlock('score_2m');

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

  // Round 4 achievement checks
  skillShotsThisGame = 0;
  captiveBallHitsThisGame = 0;

  checkSkillShot(tier: string): void {
    this.skillShotsThisGame++;
    if (tier === 'PERFECT') this.unlock('skill_shot_perfect');
    if (this.skillShotsThisGame >= 3) this.unlock('skill_shot_3');
  }

  checkSuperJackpot(): void {
    this.unlock('super_jackpot');
  }

  checkCaptiveBall(totalHits: number): void {
    this.captiveBallHitsThisGame = totalHits;
    if (totalHits >= 10) this.unlock('captive_frenzy');
  }

  checkComboTier(tier: string): void {
    if (tier === 'GODLIKE') this.unlock('godlike_combo');
  }

  checkBonusTotal(bonus: number): void {
    if (bonus >= 50000) this.unlock('bonus_50k');
  }

  checkGamesPlayed(): void {
    if (this.stats.totalGames >= 10) this.unlock('games_10');
    if (this.stats.totalGames >= 50) this.unlock('games_50');
  }

  checkMagnaSave(): void {
    this.unlock('magna_save');
  }

  private usedThemes = new Set<string>();

  checkThemeUsed(themeId: string): void {
    this.usedThemes.add(themeId);
    // Also persist used themes
    try {
      const saved = localStorage.getItem('neon-pinball-used-themes');
      const themes: string[] = saved ? JSON.parse(saved) : [];
      if (!themes.includes(themeId)) themes.push(themeId);
      localStorage.setItem('neon-pinball-used-themes', JSON.stringify(themes));
      if (themes.length >= 5) this.unlock('all_themes');
    } catch {}
  }

  checkDailyBeat(): void {
    this.unlock('daily_beat');
  }

  checkTimeAttackScore(score: number): void {
    if (score >= 100000) this.unlock('time_attack_100k');
  }

  checkOrbitComplete(combo: number): void {
    this.unlock('orbit_complete');
    if (combo >= 3) this.unlock('orbit_3x');
  }

  checkFrenzyTriggered(): void {
    this.unlock('frenzy_trigger');
  }

  checkMilestoneReached(milestone: number): void {
    if (milestone >= 1000000) this.unlock('milestone_1m');
  }

  checkScoreMilestones(score: number): void {
    if (score >= 5000000) this.unlock('score_5m');
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
