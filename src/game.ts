// Neon Pinball VR - Game State Manager
// Round 3: Wizard Mode, extra ball awards, achievement integration, dynamic intensity

export type GameState = 'title' | 'playing' | 'plunger' | 'gameover' | 'paused' | 'leaderboard' | 'settings' | 'tables' | 'achievements' | 'stats' | 'controls' | 'bonus_countdown' | 'match_sequence' | 'daily' | 'themes';

export interface ScoreEntry {
  score: number;
  table: string;
  date: string;
}

export interface TargetState {
  id: string;
  active: boolean;
  hitCount: number;
}

export type MissionType = 'ramp_combo' | 'bumper_frenzy' | 'target_blitz' | 'spinner_master' | 'multiball_madness';

export interface Mission {
  type: MissionType;
  name: string;
  description: string;
  target: number;
  progress: number;
  reward: number;
  active: boolean;
  completed: boolean;
  color: string;
}

// Intensity level for dynamic effects (music, lighting)
export type IntensityLevel = 'calm' | 'normal' | 'heated' | 'frenzy';

// Combo tier names
export type ComboTier = 'none' | 'warm_up' | 'getting_hot' | 'on_fire' | 'blazing' | 'unstoppable' | 'godlike';

export interface ComboTierDef {
  name: string;
  minCombo: number;
  color: string;
}

export const COMBO_TIERS: ComboTierDef[] = [
  { name: '', minCombo: 0, color: '#ffffff' },
  { name: 'WARM UP', minCombo: 3, color: '#00ffff' },
  { name: 'GETTING HOT', minCombo: 6, color: '#00ff88' },
  { name: 'ON FIRE', minCombo: 10, color: '#ffff00' },
  { name: 'BLAZING', minCombo: 15, color: '#ff8800' },
  { name: 'UNSTOPPABLE', minCombo: 20, color: '#ff0044' },
  { name: 'GODLIKE', minCombo: 30, color: '#ff00ff' },
];

// Skill shot zones
export interface SkillShotZone {
  name: string;
  minPower: number;
  maxPower: number;
  points: number;
  color: string;
}

export const SKILL_SHOT_ZONES: SkillShotZone[] = [
  { name: 'GOOD', minPower: 0.35, maxPower: 0.50, points: 5000, color: '#00ff88' },
  { name: 'GREAT', minPower: 0.50, maxPower: 0.65, points: 10000, color: '#ffff00' },
  { name: 'PERFECT', minPower: 0.65, maxPower: 0.75, points: 25000, color: '#ff00ff' },
  { name: 'GREAT', minPower: 0.75, maxPower: 0.85, points: 10000, color: '#ffff00' },
  { name: 'GOOD', minPower: 0.85, maxPower: 0.95, points: 5000, color: '#00ff88' },
];

// Bonus countdown data
export interface BonusCountdown {
  bumperHits: number;
  rampShots: number;
  spinnerHits: number;
  missions: number;
  maxCombo: number;
  jackpots: number;
  totalBonus: number;
}

export class GameManager {
  state: GameState = 'title';
  score = 0;
  balls = 3;
  maxBalls = 3;
  currentBall = 1;
  multiplier = 1;
  comboCount = 0;
  comboTimer = 0;
  comboTimeout = 2.0;
  totalBumperHits = 0;
  totalFlipperHits = 0;
  totalSpinnerHits = 0;
  totalRampShots = 0;
  jackpotReady = false;
  jackpotValue = 50000;
  jackpotsHit = 0;
  ballSaverActive = false;
  ballSaverTimer = 0;
  ballSaverDuration = 10;
  targets: TargetState[] = [];
  allTargetsHit = false;
  highScore = 0;
  tableName = 'Neon Classic';

  // Multiball
  multiballActive = false;
  multiballBallCount = 0;
  ballsLocked = 0;
  maxLockBalls = 3;
  multiballJackpotValue = 25000;
  multiballJackpotActive = false;

  // Ramp combo
  rampCombo = 0;
  rampComboTimer = 0;
  rampComboTimeout = 4.0;
  consecutiveLeftRamps = 0;
  consecutiveRightRamps = 0;

  // Mission system
  currentMission: Mission | null = null;
  missionsCompleted = 0;
  missionCooldown = 0;
  completedMissionTypes = new Set<MissionType>();

  // Wizard Mode
  wizardModeActive = false;
  wizardModeTimer = 0;
  wizardModeDuration = 30;       // 30 seconds of boosted scoring
  wizardModeMultiplier = 3;
  wizardModeTriggered = false;   // per-game flag

  // Extra ball
  extraBallAwarded = false;
  extraBallPending = false;

  // Dynamic intensity tracking
  intensity: IntensityLevel = 'calm';
  intensityScore = 0;  // 0-100, decays over time
  hitStreak = 0;       // consecutive hits without pause
  hitStreakTimer = 0;

  // Tilt system
  tiltWarnings = 0;
  tiltMaxWarnings = 3;
  tilted = false;
  tiltCooldown = 0;

  // Lane completion
  laneStates = [false, false, false]; // left, center, right
  laneCompletionBonus = 15000;

  // Skill shot
  skillShotAvailable = true;  // Only on first ball launch of each ball
  lastSkillShotZone: SkillShotZone | null = null;

  // Combo tiers
  currentComboTier = '';
  peakCombo = 0;  // Highest combo achieved this ball

  // Progressive super jackpot
  superJackpotValue = 100000;
  superJackpotCharged = false;  // Charged by hitting 3 jackpots in a game
  superJackpotHitCount = 0;

  // Ball save extension
  ballSaveExtended = false;

  // Bonus countdown
  bonusCountdownActive = false;
  bonusCountdownData: BonusCountdown | null = null;

  // Match sequence
  matchNumber = -1;  // -1 = not shown
  matchResult = false;

  // Captive ball
  captiveBallHits = 0;
  captiveBallBonus = 2000;

  // Daily challenge mode
  isDailyChallenge = false;

  // Current theme
  currentThemeId = 'neon-classic';

  // Magna-Save system: one magnetic outlane save per ball, activated by button press
  magnaSaveLeft = true;
  magnaSaveRight = true;
  magnaSaveActive = false;       // Currently pulling ball toward center?
  magnaSaveSide: 'left' | 'right' | null = null;
  magnaSaveDuration = 0;
  magnaSaveMaxDuration = 1.5;    // 1.5s of magnetic pull

  // Party mode
  isPartyMode = false;

  // Score values
  readonly BUMPER_SCORE = 100;
  readonly SLINGSHOT_SCORE = 50;
  readonly TARGET_SCORE = 500;
  readonly FLIPPER_SCORE = 10;
  readonly ALL_TARGETS_BONUS = 5000;
  readonly SPINNER_SCORE = 75;
  readonly RAMP_SCORE = 1000;
  readonly RAMP_COMBO_BONUS = 2500;
  readonly OUTLANE_SCORE = 250;
  readonly KICKBACK_BONUS = 1000;
  readonly BALL_LOCK_SCORE = 5000;
  readonly COMBO_MULTIPLIER_INCREMENT = 0.5;
  readonly MAX_MULTIPLIER = 10;
  readonly WIZARD_MODE_BONUS = 100000;
  readonly CAPTIVE_BALL_SCORE = 2000;

  private stateChangeCallbacks: ((state: GameState) => void)[] = [];
  private scoreCallbacks: ((score: number, label: string, x: number, z: number) => void)[] = [];
  private messageCallbacks: ((msg: string) => void)[] = [];
  private multiballCallbacks: ((active: boolean, count: number) => void)[] = [];
  private missionCallbacks: ((mission: Mission | null) => void)[] = [];
  private wizardModeCallbacks: ((active: boolean) => void)[] = [];
  private extraBallCallbacks: (() => void)[] = [];
  private tiltCallbacks: ((tilted: boolean) => void)[] = [];
  private laneCallbacks: ((lanes: boolean[]) => void)[] = [];
  private intensityCallbacks: ((level: IntensityLevel) => void)[] = [];
  private skillShotCallbacks: ((zone: SkillShotZone | null) => void)[] = [];
  private comboTierCallbacks: ((tier: string) => void)[] = [];
  private bonusCallbacks: ((data: BonusCountdown) => void)[] = [];
  private matchCallbacks: ((number: number, matched: boolean) => void)[] = [];
  private captiveBallCallbacks: ((hits: number) => void)[] = [];
  private magnaSaveCallbacks: ((side: 'left' | 'right', active: boolean, available: boolean) => void)[] = [];

  constructor() {
    this.loadHighScore();
    this.initTargets();
  }

  private initTargets(): void {
    this.targets = [];
    for (let i = 0; i < 5; i++) {
      this.targets.push({ id: `target-${i}`, active: true, hitCount: 0 });
    }
  }

  onStateChange(cb: (state: GameState) => void): void { this.stateChangeCallbacks.push(cb); }
  onScore(cb: (score: number, label: string, x: number, z: number) => void): void { this.scoreCallbacks.push(cb); }
  onMessage(cb: (msg: string) => void): void { this.messageCallbacks.push(cb); }
  onMultiball(cb: (active: boolean, count: number) => void): void { this.multiballCallbacks.push(cb); }
  onMission(cb: (mission: Mission | null) => void): void { this.missionCallbacks.push(cb); }
  onWizardMode(cb: (active: boolean) => void): void { this.wizardModeCallbacks.push(cb); }
  onExtraBall(cb: () => void): void { this.extraBallCallbacks.push(cb); }
  onIntensity(cb: (level: IntensityLevel) => void): void { this.intensityCallbacks.push(cb); }
  onTilt(cb: (tilted: boolean) => void): void { this.tiltCallbacks.push(cb); }
  onLaneComplete(cb: (lanes: boolean[]) => void): void { this.laneCallbacks.push(cb); }
  onSkillShot(cb: (zone: SkillShotZone | null) => void): void { this.skillShotCallbacks.push(cb); }
  onComboTier(cb: (tier: string) => void): void { this.comboTierCallbacks.push(cb); }
  onBonus(cb: (data: BonusCountdown) => void): void { this.bonusCallbacks.push(cb); }
  onMatch(cb: (number: number, matched: boolean) => void): void { this.matchCallbacks.push(cb); }
  onCaptiveBall(cb: (hits: number) => void): void { this.captiveBallCallbacks.push(cb); }
  onMagnaSave(cb: (side: 'left' | 'right', active: boolean, available: boolean) => void): void { this.magnaSaveCallbacks.push(cb); }

  setState(state: GameState): void {
    this.state = state;
    for (const cb of this.stateChangeCallbacks) cb(state);
  }

  startGame(): void {
    this.score = 0;
    this.balls = this.maxBalls;
    this.currentBall = 1;
    this.multiplier = 1;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.totalBumperHits = 0;
    this.totalFlipperHits = 0;
    this.totalSpinnerHits = 0;
    this.totalRampShots = 0;
    this.jackpotReady = false;
    this.jackpotsHit = 0;
    this.ballSaverActive = true;
    this.ballSaverTimer = this.ballSaverDuration;
    this.allTargetsHit = false;
    this.multiballActive = false;
    this.multiballBallCount = 0;
    this.ballsLocked = 0;
    this.rampCombo = 0;
    this.consecutiveLeftRamps = 0;
    this.consecutiveRightRamps = 0;
    this.currentMission = null;
    this.missionsCompleted = 0;
    this.completedMissionTypes.clear();
    this.missionCooldown = 5;
    this.wizardModeActive = false;
    this.wizardModeTimer = 0;
    this.wizardModeTriggered = false;
    this.extraBallAwarded = false;
    this.extraBallPending = false;
    this.intensity = 'calm';
    this.intensityScore = 0;
    this.hitStreak = 0;
    this.hitStreakTimer = 0;
    this.tiltWarnings = 0;
    this.tilted = false;
    this.tiltCooldown = 0;
    this.laneStates = [false, false, false];
    this.skillShotAvailable = true;
    this.lastSkillShotZone = null;
    this.currentComboTier = '';
    this.peakCombo = 0;
    this.superJackpotCharged = false;
    this.superJackpotHitCount = 0;
    this.ballSaveExtended = false;
    this.bonusCountdownActive = false;
    this.bonusCountdownData = null;
    this.matchNumber = -1;
    this.matchResult = false;
    this.captiveBallHits = 0;
    this.magnaSaveLeft = true;
    this.magnaSaveRight = true;
    this.magnaSaveActive = false;
    this.magnaSaveSide = null;
    this.magnaSaveDuration = 0;
    this.isPartyMode = false;
    this.initTargets();
    this.setState('plunger');
    this.emitMessage('BALL 1 - PULL TO LAUNCH!');
  }

  private getEffectiveMultiplier(): number {
    let eff = this.multiplier;
    if (this.wizardModeActive) eff *= this.wizardModeMultiplier;
    if (this.isPartyMode) eff *= 2;
    return eff;
  }

  update(dt: number): void {
    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.multiplier = 1;
      }
    }

    // Ball saver timer
    if (this.ballSaverActive) {
      this.ballSaverTimer -= dt;
      if (this.ballSaverTimer <= 0) {
        this.ballSaverActive = false;
      }
    }

    // Ramp combo timer
    if (this.rampComboTimer > 0) {
      this.rampComboTimer -= dt;
      if (this.rampComboTimer <= 0) {
        this.rampCombo = 0;
        this.consecutiveLeftRamps = 0;
        this.consecutiveRightRamps = 0;
      }
    }

    // Mission cooldown
    if (!this.currentMission && this.missionCooldown > 0 && !this.wizardModeActive) {
      this.missionCooldown -= dt;
      if (this.missionCooldown <= 0 && this.state === 'playing') {
        this.startRandomMission();
      }
    }

    // Wizard mode timer
    if (this.wizardModeActive) {
      this.wizardModeTimer -= dt;
      if (this.wizardModeTimer <= 0) {
        this.endWizardMode();
      }
    }

    // Hit streak decay
    if (this.hitStreakTimer > 0) {
      this.hitStreakTimer -= dt;
      if (this.hitStreakTimer <= 0) {
        this.hitStreak = 0;
      }
    }

    // Tilt cooldown
    if (this.tiltCooldown > 0) {
      this.tiltCooldown -= dt;
      if (this.tiltCooldown <= 0 && this.tiltWarnings > 0) {
        this.tiltWarnings = Math.max(0, this.tiltWarnings - 1);
      }
    }

    // Intensity decay
    this.intensityScore = Math.max(0, this.intensityScore - dt * 8);
    this.updateIntensity();

    // Magna-Save timer
    this.updateMagnaSave(dt);
  }

  // === Dynamic intensity ===

  private bumpIntensity(amount: number): void {
    this.intensityScore = Math.min(100, this.intensityScore + amount);
    this.hitStreak++;
    this.hitStreakTimer = 1.5; // resets streak if no hit for 1.5s
    this.updateIntensity();
  }

  private updateIntensity(): void {
    let newLevel: IntensityLevel;
    if (this.wizardModeActive || this.intensityScore > 75) {
      newLevel = 'frenzy';
    } else if (this.multiballActive || this.intensityScore > 45) {
      newLevel = 'heated';
    } else if (this.intensityScore > 20) {
      newLevel = 'normal';
    } else {
      newLevel = 'calm';
    }

    if (newLevel !== this.intensity) {
      this.intensity = newLevel;
      for (const cb of this.intensityCallbacks) cb(newLevel);
    }
  }

  // === Collision handlers ===

  handleBumperHit(bumperId: string, x: number, z: number): void {
    this.totalBumperHits++;
    this.addCombo();
    this.bumpIntensity(5);
    const eff = this.getEffectiveMultiplier();
    const points = Math.floor(this.BUMPER_SCORE * eff);
    this.addScore(points, `${points}`, x, z);

    if (this.totalBumperHits % 10 === 0) {
      this.jackpotReady = true;
      this.emitMessage('JACKPOT READY!');
    }

    // Mission progress
    if (this.currentMission?.type === 'bumper_frenzy' && this.currentMission.active) {
      this.advanceMission(1);
    }
  }

  handleSlingshotHit(id: string, x: number, z: number): void {
    this.bumpIntensity(3);
    const eff = this.getEffectiveMultiplier();
    const points = Math.floor(this.SLINGSHOT_SCORE * eff);
    this.addScore(points, `${points}`, x, z);
  }

  handleTargetHit(targetId: string, x: number, z: number): void {
    const target = this.targets.find(t => t.id === targetId);
    if (!target || !target.active) return;

    target.hitCount++;
    target.active = false;
    this.addCombo();
    this.bumpIntensity(6);

    const eff = this.getEffectiveMultiplier();
    let points = Math.floor(this.TARGET_SCORE * eff);

    const allDown = this.targets.every(t => !t.active);
    if (allDown && !this.allTargetsHit) {
      this.allTargetsHit = true;
      points += Math.floor(this.ALL_TARGETS_BONUS * eff);
      this.emitMessage('ALL TARGETS! +5000 BONUS!');
      this.bumpIntensity(15);

      if (this.ballsLocked < this.maxLockBalls && !this.multiballActive) {
        this.ballsLocked++;
        this.addScore(Math.floor(this.BALL_LOCK_SCORE * eff), 'BALL LOCKED!', x, z);
        this.emitMessage(`BALL ${this.ballsLocked}/${this.maxLockBalls} LOCKED!`);

        if (this.ballsLocked >= this.maxLockBalls) {
          this.emitMessage('MULTIBALL READY! Hit a ramp!');
        }
      }

      setTimeout(() => {
        for (const t of this.targets) t.active = true;
        this.allTargetsHit = false;
      }, 3000);
    }

    this.addScore(points, allDown ? 'BONUS!' : `${points}`, x, z);

    if (this.currentMission?.type === 'target_blitz' && this.currentMission.active) {
      this.advanceMission(1);
    }
  }

  handleFlipperHit(x: number, z: number): void {
    this.totalFlipperHits++;
    if (this.jackpotReady) {
      this.jackpotReady = false;
      this.jackpotsHit++;
      const eff = this.getEffectiveMultiplier();
      const jp = Math.floor(this.jackpotValue * eff);
      this.addScore(jp, 'JACKPOT!', x, z);
      this.emitMessage(`JACKPOT! +${jp.toLocaleString()}`);
      this.jackpotValue += 10000;
      this.bumpIntensity(20);

      // Charge super jackpot after 3 jackpots
      if (this.jackpotsHit >= 3 && !this.superJackpotCharged) {
        this.superJackpotCharged = true;
        this.emitMessage('💥 SUPER JACKPOT CHARGED! Hit the ramp! 💥');
      }
    }
  }

  handleSpinnerHit(spinnerId: string, x: number, z: number): void {
    this.totalSpinnerHits++;
    this.addCombo();
    this.bumpIntensity(3);
    const eff = this.getEffectiveMultiplier();
    const points = Math.floor(this.SPINNER_SCORE * eff);
    this.addScore(points, `${points}`, x, z);

    if (this.currentMission?.type === 'spinner_master' && this.currentMission.active) {
      this.advanceMission(1);
    }
  }

  handleRampShot(rampId: string, x: number, z: number): boolean {
    this.totalRampShots++;
    this.rampCombo++;
    this.rampComboTimer = this.rampComboTimeout;
    this.addCombo();
    this.bumpIntensity(10);

    if (rampId === 'ramp-left') {
      this.consecutiveLeftRamps++;
      this.consecutiveRightRamps = 0;
    } else {
      this.consecutiveRightRamps++;
      this.consecutiveLeftRamps = 0;
    }

    const eff = this.getEffectiveMultiplier();
    let points = Math.floor(this.RAMP_SCORE * eff);

    if (this.rampCombo >= 3) {
      const comboBonus = Math.floor(this.RAMP_COMBO_BONUS * (this.rampCombo - 2) * eff);
      points += comboBonus;
      this.emitMessage(`RAMP COMBO x${this.rampCombo}! +${comboBonus.toLocaleString()}`);
    }

    const consec = Math.max(this.consecutiveLeftRamps, this.consecutiveRightRamps);
    if (consec >= 3) {
      points += Math.floor(10000 * eff);
      this.emitMessage('SUPER RAMP! +10,000!');
    }

    this.addScore(points, `${points}`, x, z);

    // Ball save extension from ramp shots (first ramp only)
    if (this.ballSaverActive && !this.ballSaveExtended && this.totalRampShots === 1) {
      this.extendBallSave(5);
    }

    // Super jackpot trigger (ramp when charged)
    if (this.superJackpotCharged) {
      this.handleSuperJackpot(x, z);
    }

    let triggeredMultiball = false;
    if (this.ballsLocked >= this.maxLockBalls && !this.multiballActive) {
      triggeredMultiball = true;
      this.startMultiball();
    }

    if (this.currentMission?.type === 'ramp_combo' && this.currentMission.active) {
      this.advanceMission(1);
    }

    return triggeredMultiball;
  }

  handleKickback(outlaneId: string, x: number, z: number): void {
    const eff = this.getEffectiveMultiplier();
    const points = Math.floor(this.KICKBACK_BONUS * eff);
    this.addScore(points, 'KICKBACK!', x, z);
    this.emitMessage('KICKBACK SAVE!');
  }

  handleDrain(): { saved: boolean; isMultiballDrain: boolean } {
    if (this.multiballActive) {
      this.multiballBallCount--;
      if (this.multiballBallCount <= 1) {
        this.endMultiball();
      }
      return { saved: false, isMultiballDrain: true };
    }

    if (this.ballSaverActive) {
      this.emitMessage('BALL SAVED!');
      return { saved: true, isMultiballDrain: false };
    }

    // Check extra ball
    if (this.extraBallPending) {
      this.extraBallPending = false;
      this.emitMessage('EXTRA BALL!');
      for (const cb of this.extraBallCallbacks) cb();
      this.ballSaverActive = true;
      this.ballSaverTimer = 5;
      return { saved: true, isMultiballDrain: false };
    }

    // Trigger bonus countdown before ball loss
    this.bonusCountdownData = this.calculateBonus();
    if (this.bonusCountdownData.totalBonus > 0) {
      this.bonusCountdownActive = true;
      for (const cb of this.bonusCallbacks) cb(this.bonusCountdownData);
    }

    this.balls--;
    if (this.balls <= 0) {
      // Apply bonus then end game
      if (this.bonusCountdownData) {
        this.applyBonus(this.bonusCountdownData);
      }
      this.endGame();
      return { saved: false, isMultiballDrain: false };
    }

    // Apply bonus
    if (this.bonusCountdownData) {
      this.applyBonus(this.bonusCountdownData);
      this.emitMessage(`BONUS +${this.bonusCountdownData.totalBonus.toLocaleString()}`);
    }

    this.currentBall++;
    this.multiplier = 1;
    this.comboCount = 0;
    this.currentComboTier = '';
    this.peakCombo = 0;
    this.skillShotAvailable = true;
    this.ballSaveExtended = false;
    this.ballSaverActive = true;
    this.ballSaverTimer = this.ballSaverDuration;
    this.magnaSaveLeft = true;
    this.magnaSaveRight = true;
    this.magnaSaveActive = false;
    this.magnaSaveSide = null;
    this.magnaSaveDuration = 0;
    this.setState('plunger');
    this.emitMessage(`BALL ${this.currentBall} - PULL TO LAUNCH!`);
    return { saved: false, isMultiballDrain: false };
  }

  // === Multiball ===

  startMultiball(): void {
    this.multiballActive = true;
    this.multiballBallCount = this.maxLockBalls + 1;
    this.ballsLocked = 0;
    this.multiballJackpotActive = true;
    this.multiballJackpotValue = 25000 + (this.missionsCompleted * 5000);
    this.bumpIntensity(30);

    for (const cb of this.multiballCallbacks) cb(true, this.multiballBallCount);
    this.emitMessage(`MULTIBALL! ${this.multiballBallCount} BALLS!`);

    if (this.currentMission?.type === 'multiball_madness' && this.currentMission.active) {
      this.advanceMission(1);
    }
  }

  endMultiball(): void {
    this.multiballActive = false;
    this.multiballJackpotActive = false;
    for (const cb of this.multiballCallbacks) cb(false, 1);
    this.emitMessage('MULTIBALL ENDED');
  }

  handleMultiballJackpot(x: number, z: number): void {
    if (!this.multiballJackpotActive) return;
    const eff = this.getEffectiveMultiplier();
    const jp = Math.floor(this.multiballJackpotValue * eff);
    this.addScore(jp, 'MB JACKPOT!', x, z);
    this.emitMessage(`MULTIBALL JACKPOT! +${jp.toLocaleString()}`);
    this.multiballJackpotValue += 5000;
    this.bumpIntensity(25);
  }

  // === Wizard Mode ===

  private checkWizardModeEligible(): boolean {
    return this.completedMissionTypes.size >= 5 && !this.wizardModeTriggered;
  }

  startWizardMode(): void {
    this.wizardModeActive = true;
    this.wizardModeTimer = this.wizardModeDuration;
    this.wizardModeTriggered = true;
    this.bumpIntensity(50);

    // Grant wizard mode bonus
    this.score += this.WIZARD_MODE_BONUS;
    this.emitMessage(`⚡ WIZARD MODE! ⚡ ALL SCORES x${this.wizardModeMultiplier}!`);
    this.emitMessage(`+${this.WIZARD_MODE_BONUS.toLocaleString()} WIZARD BONUS!`);

    for (const cb of this.wizardModeCallbacks) cb(true);
  }

  private endWizardMode(): void {
    this.wizardModeActive = false;
    this.emitMessage('WIZARD MODE ENDED');
    for (const cb of this.wizardModeCallbacks) cb(false);

    // Award extra ball after wizard mode ends
    this.awardExtraBall();
  }

  // === Extra Ball ===

  awardExtraBall(): void {
    if (this.extraBallAwarded) return; // Only one extra ball per game
    this.extraBallAwarded = true;
    this.extraBallPending = true;
    this.emitMessage('🌟 EXTRA BALL EARNED! 🌟');
    for (const cb of this.extraBallCallbacks) cb();
  }

  // === Mission System ===

  private startRandomMission(): void {
    const missionDefs: Omit<Mission, 'active' | 'completed' | 'progress'>[] = [
      { type: 'ramp_combo', name: 'RAMP RUNNER', description: 'Hit 5 ramps', target: 5, reward: 25000, color: '#ff00ff' },
      { type: 'bumper_frenzy', name: 'BUMPER FRENZY', description: 'Hit bumpers 20 times', target: 20, reward: 20000, color: '#ff8800' },
      { type: 'target_blitz', name: 'TARGET BLITZ', description: 'Hit 8 targets', target: 8, reward: 30000, color: '#00ff88' },
      { type: 'spinner_master', name: 'SPIN CITY', description: 'Hit spinners 10 times', target: 10, reward: 15000, color: '#ffff00' },
      { type: 'multiball_madness', name: 'MULTIBALL MADNESS', description: 'Trigger multiball', target: 1, reward: 50000, color: '#4488ff' },
    ];

    // Prefer mission types not yet completed (for wizard mode progression)
    const uncompletedTypes = missionDefs.filter(m => !this.completedMissionTypes.has(m.type));
    const pool = uncompletedTypes.length > 0 ? uncompletedTypes : missionDefs;

    // Avoid repeating the just-completed mission
    const available = pool.filter(m =>
      !this.currentMission || m.type !== this.currentMission.type
    );
    const finalPool = available.length > 0 ? available : pool;
    const def = finalPool[Math.floor(Math.random() * finalPool.length)];

    this.currentMission = {
      ...def,
      progress: 0,
      active: true,
      completed: false,
    };

    this.emitMessage(`MISSION: ${def.name}`);
    for (const cb of this.missionCallbacks) cb(this.currentMission);
  }

  private advanceMission(amount: number): void {
    if (!this.currentMission || !this.currentMission.active) return;

    this.currentMission.progress = Math.min(
      this.currentMission.target,
      this.currentMission.progress + amount,
    );

    if (this.currentMission.progress >= this.currentMission.target) {
      this.completeMission();
    }

    for (const cb of this.missionCallbacks) cb(this.currentMission);
  }

  private completeMission(): void {
    if (!this.currentMission) return;

    this.currentMission.completed = true;
    this.currentMission.active = false;
    this.missionsCompleted++;
    this.completedMissionTypes.add(this.currentMission.type);
    this.bumpIntensity(20);

    const eff = this.getEffectiveMultiplier();
    const reward = Math.floor(this.currentMission.reward * eff);
    this.score += reward;
    this.emitMessage(`MISSION COMPLETE! +${reward.toLocaleString()}`);

    // Check extra ball award (3rd mission complete)
    if (this.missionsCompleted === 3 && !this.extraBallAwarded) {
      this.awardExtraBall();
    }

    for (const cb of this.missionCallbacks) cb(null);

    // Check wizard mode
    if (this.checkWizardModeEligible()) {
      this.currentMission = null;
      setTimeout(() => this.startWizardMode(), 1500);
      return;
    }

    this.currentMission = null;
    this.missionCooldown = 8 + Math.random() * 7;
  }

  // === Tilt ===

  handleNudge(): boolean {
    if (this.tilted) return false;

    this.tiltCooldown = 2.0;
    this.tiltWarnings++;

    if (this.tiltWarnings >= this.tiltMaxWarnings) {
      this.tilted = true;
      this.emitMessage('TILT! Flippers disabled!');
      for (const cb of this.tiltCallbacks) cb(true);
      return false; // tilt = no nudge effect
    }

    if (this.tiltWarnings === this.tiltMaxWarnings - 1) {
      this.emitMessage('DANGER! One more nudge = TILT!');
    }

    return true; // nudge allowed
  }

  // === Lane completion ===

  handleLaneHit(laneIndex: number, x: number, z: number): void {
    if (laneIndex < 0 || laneIndex > 2 || this.laneStates[laneIndex]) return;

    this.laneStates[laneIndex] = true;
    for (const cb of this.laneCallbacks) cb([...this.laneStates]);

    // Check all lanes complete
    if (this.laneStates.every(l => l)) {
      const eff = this.getEffectiveMultiplier();
      const bonus = Math.floor(this.laneCompletionBonus * eff);
      this.addScore(bonus, 'LANES COMPLETE!', x, z);
      this.emitMessage(`LANES COMPLETE! +${bonus.toLocaleString()}`);
      this.bumpIntensity(12);

      // Reset lanes for next completion
      this.laneStates = [false, false, false];
      for (const cb of this.laneCallbacks) cb([...this.laneStates]);
    }
  }

  // === Skill Shot ===

  handleSkillShot(plungerPower: number, x: number, z: number): void {
    if (!this.skillShotAvailable) return;
    this.skillShotAvailable = false;

    let hitZone: SkillShotZone | null = null;
    for (const zone of SKILL_SHOT_ZONES) {
      if (plungerPower >= zone.minPower && plungerPower < zone.maxPower) {
        hitZone = zone;
        break;
      }
    }

    this.lastSkillShotZone = hitZone;
    if (hitZone) {
      const eff = this.getEffectiveMultiplier();
      const points = Math.floor(hitZone.points * eff);
      this.addScore(points, `SKILL SHOT!`, x, z);
      this.emitMessage(`${hitZone.name} SKILL SHOT! +${points.toLocaleString()}`);
      this.bumpIntensity(15);
    }

    for (const cb of this.skillShotCallbacks) cb(hitZone);
  }

  // === Combo Tiers ===

  private updateComboTier(): void {
    let tierName = '';
    for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
      if (this.comboCount >= COMBO_TIERS[i].minCombo) {
        tierName = COMBO_TIERS[i].name;
        break;
      }
    }

    if (tierName !== this.currentComboTier) {
      this.currentComboTier = tierName;
      if (tierName) {
        this.emitMessage(`🔥 ${tierName}!`);
      }
      for (const cb of this.comboTierCallbacks) cb(tierName);
    }

    // Track peak combo for bonus
    if (this.comboCount > this.peakCombo) {
      this.peakCombo = this.comboCount;
    }
  }

  // === Captive Ball ===

  handleCaptiveBallHit(x: number, z: number): void {
    this.captiveBallHits++;
    this.bumpIntensity(8);
    const eff = this.getEffectiveMultiplier();
    const points = Math.floor(this.CAPTIVE_BALL_SCORE * this.captiveBallHits * eff);
    this.addScore(points, `CAPTIVE ${this.captiveBallHits}x`, x, z);

    if (this.captiveBallHits % 5 === 0) {
      const megaBonus = Math.floor(10000 * eff);
      this.addScore(megaBonus, 'CAPTIVE FRENZY!', x, z);
      this.emitMessage(`CAPTIVE FRENZY x${this.captiveBallHits}! +${megaBonus.toLocaleString()}`);
    }

    for (const cb of this.captiveBallCallbacks) cb(this.captiveBallHits);
  }

  // === Magna-Save ===

  activateMagnaSave(side: 'left' | 'right'): boolean {
    if (this.magnaSaveActive) return false;
    if (side === 'left' && !this.magnaSaveLeft) return false;
    if (side === 'right' && !this.magnaSaveRight) return false;
    if (this.state !== 'playing') return false;

    this.magnaSaveActive = true;
    this.magnaSaveSide = side;
    this.magnaSaveDuration = this.magnaSaveMaxDuration;

    if (side === 'left') this.magnaSaveLeft = false;
    else this.magnaSaveRight = false;

    this.emitMessage(`MAGNA-SAVE ${side.toUpperCase()}!`);
    this.bumpIntensity(5);

    for (const cb of this.magnaSaveCallbacks) cb(side, true, side === 'left' ? this.magnaSaveLeft : this.magnaSaveRight);
    return true;
  }

  updateMagnaSave(dt: number): void {
    if (!this.magnaSaveActive) return;
    this.magnaSaveDuration -= dt;
    if (this.magnaSaveDuration <= 0) {
      this.magnaSaveActive = false;
      const side = this.magnaSaveSide || 'left';
      this.magnaSaveSide = null;
      for (const cb of this.magnaSaveCallbacks) cb(side, false, false);
    }
  }

  getMagnaSaveForce(): { fx: number; fz: number } | null {
    if (!this.magnaSaveActive || !this.magnaSaveSide) return null;
    // Pull ball toward center of table (away from outlane)
    const force = 2.5;
    const fx = this.magnaSaveSide === 'left' ? force : -force;
    return { fx, fz: -force * 0.3 };
  }

  // === Party Mode ===

  startPartyMode(): void {
    this.isPartyMode = true;
    this.maxBalls = 1;
    this.startGame();
    this.emitMessage('🎉 PARTY MODE! 1 BALL, 2x SCORING! 🎉');
  }

  // === Bonus Countdown ===

  calculateBonus(): BonusCountdown {
    const bumperBonus = this.totalBumperHits * 50;
    const rampBonus = this.totalRampShots * 300;
    const spinnerBonus = this.totalSpinnerHits * 25;
    const missionBonus = this.missionsCompleted * 5000;
    const comboBonus = Math.floor(this.peakCombo * 500);
    const jackpotBonus = this.jackpotsHit * 2000;
    const totalBonus = bumperBonus + rampBonus + spinnerBonus + missionBonus + comboBonus + jackpotBonus;

    return {
      bumperHits: this.totalBumperHits,
      rampShots: this.totalRampShots,
      spinnerHits: this.totalSpinnerHits,
      missions: this.missionsCompleted,
      maxCombo: this.peakCombo,
      jackpots: this.jackpotsHit,
      totalBonus,
    };
  }

  applyBonus(data: BonusCountdown): void {
    this.score += data.totalBonus;
    this.bonusCountdownActive = false;
  }

  // === Match Sequence ===

  runMatchSequence(): void {
    // Random 2-digit match number (multiples of 10)
    const matchTarget = Math.floor(Math.random() * 10) * 10;
    const scoreLastTwo = this.score % 100;
    const rounded = Math.floor(scoreLastTwo / 10) * 10;
    const matched = rounded === matchTarget;

    this.matchNumber = matchTarget;
    this.matchResult = matched;

    for (const cb of this.matchCallbacks) cb(matchTarget, matched);

    if (matched) {
      this.emitMessage('MATCH! FREE CREDIT!');
    }
  }

  // === Super Jackpot ===

  handleSuperJackpot(x: number, z: number): boolean {
    if (!this.superJackpotCharged) return false;
    this.superJackpotCharged = false;
    const eff = this.getEffectiveMultiplier();
    const points = Math.floor(this.superJackpotValue * eff);
    this.addScore(points, 'SUPER JACKPOT!', x, z);
    this.emitMessage(`💥 SUPER JACKPOT! +${points.toLocaleString()} 💥`);
    this.superJackpotValue += 25000; // Progressive
    this.bumpIntensity(40);
    return true;
  }

  // === Ball Save Extension ===

  extendBallSave(seconds: number): void {
    if (!this.ballSaveExtended && this.ballSaverActive) {
      this.ballSaveExtended = true;
      this.ballSaverTimer += seconds;
      this.emitMessage(`BALL SAVER +${seconds}s!`);
    }
  }

  // === VUK ===

  handleVUKHit(x: number, z: number): void {
    this.bumpIntensity(8);
    const eff = this.getEffectiveMultiplier();
    const points = Math.floor(3000 * eff);
    this.addScore(points, 'VUK!', x, z);
    this.emitMessage(`VUK LAUNCH! +${points.toLocaleString()}`);
    this.addCombo();
  }

  // === Core scoring ===

  private endGame(): void {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
      this.emitMessage('NEW HIGH SCORE!');
    }
    this.saveToLeaderboard();
    this.setState('gameover');

    // Run match sequence after a delay
    setTimeout(() => {
      if (this.state === 'gameover') {
        this.runMatchSequence();
      }
    }, 2000);
  }

  private addCombo(): void {
    this.comboCount++;
    this.comboTimer = this.comboTimeout;
    this.multiplier = Math.min(this.MAX_MULTIPLIER, 1 + (this.comboCount - 1) * this.COMBO_MULTIPLIER_INCREMENT);

    if (this.comboCount === 5) this.emitMessage('5x COMBO!');
    else if (this.comboCount === 10) this.emitMessage('10x COMBO! MULTIPLIER x' + this.multiplier.toFixed(1));
    else if (this.comboCount === 20) this.emitMessage('INSANE COMBO!');

    this.updateComboTier();
  }

  private addScore(points: number, label: string, x: number, z: number): void {
    this.score += points;
    for (const cb of this.scoreCallbacks) cb(points, label, x, z);
  }

  private emitMessage(msg: string): void {
    for (const cb of this.messageCallbacks) cb(msg);
  }

  // Persistence
  private loadHighScore(): void {
    try {
      const saved = localStorage.getItem('neon-pinball-highscore');
      if (saved) this.highScore = parseInt(saved, 10);
    } catch {}
  }

  private saveHighScore(): void {
    try {
      localStorage.setItem('neon-pinball-highscore', String(this.highScore));
    } catch {}
  }

  saveToLeaderboard(): void {
    try {
      const key = 'neon-pinball-leaderboard';
      const raw = localStorage.getItem(key);
      const entries: ScoreEntry[] = raw ? JSON.parse(raw) : [];
      entries.push({
        score: this.score,
        table: this.tableName,
        date: new Date().toISOString(),
      });
      entries.sort((a, b) => b.score - a.score);
      localStorage.setItem(key, JSON.stringify(entries.slice(0, 10)));
    } catch {}
  }

  getLeaderboard(): ScoreEntry[] {
    try {
      const raw = localStorage.getItem('neon-pinball-leaderboard');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
}
