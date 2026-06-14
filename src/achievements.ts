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
  totalSpinnerHits: number;
  totalOrbits: number;
  totalJackpots: number;
  totalDrains: number;
  longestBallSeconds: number;
}

const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked' | 'unlockedDate'>[] = [
  { id: 'first_game', name: 'FIRST TILT', description: 'Play your first game', icon: '*', color: '#00ffff' },
  { id: 'score_100k', name: 'SIX FIGURES', description: 'Score 100,000 points', icon: '#', color: '#ffff00' },
  { id: 'score_500k', name: 'HALF MILLION', description: 'Score 500,000 points', icon: 'D', color: '#ff00ff' },
  { id: 'score_1m', name: 'MILLIONAIRE', description: 'Score 1,000,000 points', icon: 'K', color: '#ff8800' },
  { id: 'combo_5x', name: 'COMBO STARTER', description: 'Reach a 5x combo', icon: '!', color: '#00ff88' },
  { id: 'combo_10x', name: 'COMBO KING', description: 'Reach the max 10x multiplier', icon: 'F', color: '#ff4400' },
  { id: 'first_multiball', name: 'MULTI MAYHEM', description: 'Trigger multiball', icon: 'M', color: '#4488ff' },
  { id: 'first_mission', name: 'MISSION ACCEPTED', description: 'Complete a mission', icon: 'T', color: '#00ff88' },
  { id: 'all_missions', name: 'MISSION MASTER', description: 'Complete all 5 mission types', icon: 'W', color: '#ffff00' },
  { id: 'wizard_mode', name: 'WIZARD!', description: 'Activate Wizard Mode', icon: 'W', color: '#ff00ff' },
  { id: 'ramp_combo_5', name: 'RAMP RUNNER', description: 'Hit 5 ramp combos in a row', icon: 'R', color: '#ff00ff' },
  { id: 'super_ramp', name: 'SUPER RAMP', description: 'Trigger a Super Ramp bonus', icon: '^', color: '#00ffff' },
  { id: 'jackpot_3', name: 'JACKPOT HUNTER', description: 'Hit 3 jackpots in one game', icon: 'J', color: '#ffff00' },
  { id: 'no_drain', name: 'STEEL NERVES', description: 'Score 50,000 on ball 1', icon: 'S', color: '#00ff88' },
  { id: 'extra_ball', name: 'EXTRA! EXTRA!', description: 'Earn your first extra ball', icon: 'E', color: '#ff8800' },
  { id: 'bumper_100', name: 'BUMPER BASH', description: 'Hit bumpers 100 times in one game', icon: 'B', color: '#ff4400' },
  // Round 4 achievements
  { id: 'skill_shot_perfect', name: 'SHARP SHOOTER', description: 'Land a Perfect skill shot', icon: 'T', color: '#ff00ff' },
  { id: 'skill_shot_3', name: 'SKILL MASTER', description: 'Land 3 skill shots in one game', icon: '3', color: '#ffff00' },
  { id: 'super_jackpot', name: 'SUPER JACKPOT!', description: 'Hit the Super Jackpot', icon: 'D', color: '#ff00ff' },
  { id: 'captive_frenzy', name: 'CAPTIVE MANIAC', description: 'Hit the captive ball 10 times', icon: 'C', color: '#4400ff' },
  { id: 'godlike_combo', name: 'GODLIKE', description: 'Reach GODLIKE combo tier', icon: '!', color: '#ff00ff' },
  { id: 'bonus_50k', name: 'BONUS BONANZA', description: 'Earn 50,000+ end-of-ball bonus', icon: '$', color: '#ffff00' },
  { id: 'games_10', name: 'REGULAR', description: 'Play 10 games', icon: 'H', color: '#00ffff' },
  { id: 'games_50', name: 'ADDICT', description: 'Play 50 games', icon: 'F', color: '#ff4400' },
  // Round 5 achievements
  { id: 'magna_save', name: 'MAGNETIC PULL', description: 'Use Magna-Save to save the ball', icon: 'M', color: '#4488ff' },
  { id: 'all_themes', name: 'FASHIONISTA', description: 'Try all 5 table themes', icon: 'P', color: '#ff00ff' },
  { id: 'daily_beat', name: 'DAILY CHAMPION', description: 'Beat a daily challenge target', icon: 'D', color: '#ffff00' },
  { id: 'score_2m', name: 'DOUBLE MILLIONAIRE', description: 'Score 2,000,000 points', icon: 'J', color: '#ff8800' },
  { id: 'time_attack_100k', name: 'SPEED DEMON', description: 'Score 100K in Time Attack', icon: 'T', color: '#ff4400' },
  { id: 'orbit_complete', name: 'ORBIT KING', description: 'Complete a full orbit shot', icon: 'O', color: '#00ccff' },
  { id: 'orbit_3x', name: 'ORBITAL MADNESS', description: 'Hit 3 consecutive orbits', icon: 'O', color: '#00ffff' },
  { id: 'frenzy_trigger', name: 'FRENZY!', description: 'Trigger Frenzy bonus round', icon: 'F', color: '#ff6600' },
  { id: 'milestone_1m', name: 'MILESTONE MASTER', description: 'Reach the 1M score milestone', icon: '*', color: '#ffd700' },
  { id: 'score_5m', name: 'FIVE MILLION', description: 'Score 5,000,000 points', icon: 'W', color: '#ffd700' },
  // Round 11 achievements
  { id: 'lane_master', name: 'LANE MASTER', description: 'Complete all 3 lanes', icon: 'L', color: '#00ffff' },
  { id: 'lane_perfectionist', name: 'LANE PERFECTIONIST', description: 'Complete all lanes 3 times in one game', icon: '!', color: '#ffff00' },
  { id: 'no_tilt', name: 'ZEN MASTER', description: 'Finish a game without any tilt warnings', icon: 'Z', color: '#00ff88' },
  { id: 'ball_saved_3', name: 'GUARDIAN ANGEL', description: 'Ball saved 3 times in one game', icon: 'G', color: '#4488ff' },
  { id: 'long_ball', name: 'MARATHON', description: 'Keep one ball alive for 60 seconds', icon: 'H', color: '#ff8800' },
  { id: 'difficulty_3', name: 'RISING STAR', description: 'Reach difficulty level 3', icon: 'A', color: '#ffaa00' },
  { id: 'orbit_5', name: 'ORBITAL MASTER', description: 'Complete 5 orbits in one game', icon: 'O', color: '#00ffaa' },
  { id: 'ramp_10', name: 'RAMP KING', description: 'Hit 10 ramp shots in one game', icon: 'R', color: '#ff00ff' },
  // Round 20 achievements
  { id: 'captive_20', name: 'CAGE BREAKER', description: 'Hit the captive ball 20 times in one game', icon: 'X', color: '#aa00ff' },
  { id: 'score_10m', name: 'TEN MILLION', description: 'Score 10,000,000 points', icon: 'K', color: '#ffd700' },
  { id: 'frenzy_3', name: 'FRENZY ADDICT', description: 'Trigger Frenzy 3 times in one game', icon: 'F', color: '#ff6600' },
  { id: 'orbit_combo_5', name: 'ORBIT STREAK', description: 'Hit 5 consecutive orbits', icon: 'O', color: '#00ffee' },
  { id: 'all_missions_8', name: 'COMPLETIONIST', description: 'Complete all 8 mission types', icon: 'W', color: '#ff44ff' },
  { id: 'spinner_50', name: 'SPIN DOCTOR', description: 'Hit spinners 50 times in one game', icon: 'S', color: '#ffff00' },
  { id: 'multiball_3', name: 'MULTI MASTER', description: 'Trigger multiball 3 times in one game', icon: 'M', color: '#4488ff' },
  { id: 'games_100', name: 'PINBALL VETERAN', description: 'Play 100 games', icon: 'V', color: '#ffd700' },
  { id: 'difficulty_5', name: 'IRONMAN', description: 'Reach difficulty level 5', icon: '!', color: '#ff0044' },
  { id: 'combo_godlike_2', name: 'DOUBLE GODLIKE', description: 'Reach GODLIKE combo twice in one game', icon: '!', color: '#ff00ff' },
  { id: 'target_master', name: 'TARGET MASTER', description: 'Clear all targets 5 times in one game', icon: 'T', color: '#00ff88' },
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
    this.multiballTriggersThisGame++;
    if (this.multiballTriggersThisGame >= 3) this.unlock('multiball_3');
  }

  checkMissionComplete(missionType: string): void {
    this.stats.totalMissionsCompleted++;
    this.unlock('first_mission');
    this.missionsCompletedTypes.add(missionType);
    if (this.missionsCompletedTypes.size >= 5) {
      this.unlock('all_missions');
    }
    if (this.missionsCompletedTypes.size >= 8) {
      this.unlock('all_missions_8');
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
    this.stats.totalJackpots++;
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
    if (totalHits >= 20) this.unlock('captive_20');
  }

  checkComboTier(tier: string): void {
    if (tier === 'GODLIKE') {
      this.unlock('godlike_combo');
      this.godlikeComboCount++;
      if (this.godlikeComboCount >= 2) this.unlock('combo_godlike_2');
    }
  }

  checkBonusTotal(bonus: number): void {
    if (bonus >= 50000) this.unlock('bonus_50k');
  }

  checkDifficultyLevel(level: number): void {
    if (level >= 3) this.unlock('difficulty_3');
    if (level >= 5) this.unlock('difficulty_5');
  }

  checkOrbitCount(orbits: number): void {
    if (orbits >= 5) this.unlock('orbit_5');
  }

  checkRampCount(ramps: number): void {
    if (ramps >= 10) this.unlock('ramp_10');
  }

  checkGamesPlayed(): void {
    if (this.stats.totalGames >= 10) this.unlock('games_10');
    if (this.stats.totalGames >= 50) this.unlock('games_50');
    if (this.stats.totalGames >= 100) this.unlock('games_100');
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
    this.stats.totalOrbits++;
    if (combo >= 3) this.unlock('orbit_3x');
    if (combo >= 5) this.unlock('orbit_combo_5');
  }

  checkFrenzyTriggered(): void {
    this.unlock('frenzy_trigger');
    this.frenzyTriggersThisGame++;
    if (this.frenzyTriggersThisGame >= 3) this.unlock('frenzy_3');
  }

  checkMilestoneReached(milestone: number): void {
    if (milestone >= 1000000) this.unlock('milestone_1m');
  }

  checkScoreMilestones(score: number): void {
    if (score >= 5000000) this.unlock('score_5m');
    if (score >= 10000000) this.unlock('score_10m');
  }

  // Round 11 achievement checks
  laneCompletions = 0;
  ballSavesThisGame = 0;
  tiltWarningsThisGame = 0;
  ballAliveTime = 0;
  frenzyTriggersThisGame = 0;
  multiballTriggersThisGame = 0;
  godlikeComboCount = 0;

  checkLaneComplete(): void {
    this.laneCompletions++;
    this.unlock('lane_master');
    if (this.laneCompletions >= 3) this.unlock('lane_perfectionist');
  }

  checkNoTilt(): void {
    // Called at game over — if no tilt warnings were issued
    if (this.tiltWarningsThisGame === 0) this.unlock('no_tilt');
  }

  recordTiltWarning(): void {
    this.tiltWarningsThisGame++;
  }

  checkBallSaved(): void {
    this.ballSavesThisGame++;
    if (this.ballSavesThisGame >= 3) this.unlock('ball_saved_3');
  }

  resetRoundStats(): void {
    this.laneCompletions = 0;
    this.ballSavesThisGame = 0;
    this.tiltWarningsThisGame = 0;
    this.ballAliveTime = 0;
    this.frenzyTriggersThisGame = 0;
    this.multiballTriggersThisGame = 0;
    this.godlikeComboCount = 0;
  }

  checkSpinnerCount(count: number): void {
    this.stats.totalSpinnerHits++;
    if (count >= 50) this.unlock('spinner_50');
  }

  recordDrain(): void {
    this.stats.totalDrains++;
  }

  checkBallAliveTime(elapsed: number): void {
    this.ballAliveTime = elapsed;
    if (elapsed > this.stats.longestBallSeconds) {
      this.stats.longestBallSeconds = elapsed;
    }
    if (elapsed >= 60) this.unlock('long_ball');
  }

  checkTargetBankCompletions(count: number): void {
    if (count >= 5) this.unlock('target_master');
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
      totalPlayTimeSeconds: 0, totalSpinnerHits: 0, totalOrbits: 0,
      totalJackpots: 0, totalDrains: 0, longestBallSeconds: 0,
    };
  }

  private saveStats(): void {
    try {
      localStorage.setItem('neon-pinball-stats', JSON.stringify(this.stats));
    } catch {}
  }
}
