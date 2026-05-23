// Neon Pinball VR - Game State Manager
// Round 2: Multiball, mission system, ramp combos, spinner scoring, outlane kickbacks

export type GameState = 'title' | 'playing' | 'plunger' | 'gameover' | 'paused' | 'leaderboard' | 'settings' | 'tables';

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
  target: number;      // goal amount
  progress: number;    // current progress
  reward: number;      // base score reward
  active: boolean;
  completed: boolean;
  color: string;       // neon color for UI
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

  private stateChangeCallbacks: ((state: GameState) => void)[] = [];
  private scoreCallbacks: ((score: number, label: string, x: number, z: number) => void)[] = [];
  private messageCallbacks: ((msg: string) => void)[] = [];
  private multiballCallbacks: ((active: boolean, count: number) => void)[] = [];
  private missionCallbacks: ((mission: Mission | null) => void)[] = [];

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
    this.missionCooldown = 5; // first mission after 5s
    this.initTargets();
    this.setState('plunger');
    this.emitMessage('BALL 1 - PULL TO LAUNCH!');
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
    if (!this.currentMission && this.missionCooldown > 0) {
      this.missionCooldown -= dt;
      if (this.missionCooldown <= 0 && this.state === 'playing') {
        this.startRandomMission();
      }
    }
  }

  // === Collision handlers ===

  handleBumperHit(bumperId: string, x: number, z: number): void {
    this.totalBumperHits++;
    this.addCombo();
    const points = Math.floor(this.BUMPER_SCORE * this.multiplier);
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
    const points = Math.floor(this.SLINGSHOT_SCORE * this.multiplier);
    this.addScore(points, `${points}`, x, z);
  }

  handleTargetHit(targetId: string, x: number, z: number): void {
    const target = this.targets.find(t => t.id === targetId);
    if (!target || !target.active) return;

    target.hitCount++;
    target.active = false;
    this.addCombo();

    let points = Math.floor(this.TARGET_SCORE * this.multiplier);

    // Check all targets down
    const allDown = this.targets.every(t => !t.active);
    if (allDown && !this.allTargetsHit) {
      this.allTargetsHit = true;
      points += this.ALL_TARGETS_BONUS;
      this.emitMessage('ALL TARGETS! +5000 BONUS!');

      // All targets = lock a ball (towards multiball)
      if (this.ballsLocked < this.maxLockBalls && !this.multiballActive) {
        this.ballsLocked++;
        this.addScore(this.BALL_LOCK_SCORE, 'BALL LOCKED!', x, z);
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

    // Mission progress
    if (this.currentMission?.type === 'target_blitz' && this.currentMission.active) {
      this.advanceMission(1);
    }
  }

  handleFlipperHit(x: number, z: number): void {
    this.totalFlipperHits++;
    if (this.jackpotReady) {
      this.jackpotReady = false;
      const jp = Math.floor(this.jackpotValue * this.multiplier);
      this.addScore(jp, 'JACKPOT!', x, z);
      this.emitMessage(`JACKPOT! +${jp.toLocaleString()}`);
      this.jackpotValue += 10000;
    }
  }

  handleSpinnerHit(spinnerId: string, x: number, z: number): void {
    this.totalSpinnerHits++;
    this.addCombo();
    const points = Math.floor(this.SPINNER_SCORE * this.multiplier);
    this.addScore(points, `${points}`, x, z);

    // Mission progress
    if (this.currentMission?.type === 'spinner_master' && this.currentMission.active) {
      this.advanceMission(1);
    }
  }

  handleRampShot(rampId: string, x: number, z: number): boolean {
    this.totalRampShots++;
    this.rampCombo++;
    this.rampComboTimer = this.rampComboTimeout;
    this.addCombo();

    // Track consecutive same-ramp shots
    if (rampId === 'ramp-left') {
      this.consecutiveLeftRamps++;
      this.consecutiveRightRamps = 0;
    } else {
      this.consecutiveRightRamps++;
      this.consecutiveLeftRamps = 0;
    }

    let points = Math.floor(this.RAMP_SCORE * this.multiplier);

    // Ramp combo bonus
    if (this.rampCombo >= 3) {
      const comboBonus = Math.floor(this.RAMP_COMBO_BONUS * (this.rampCombo - 2) * this.multiplier);
      points += comboBonus;
      this.emitMessage(`RAMP COMBO x${this.rampCombo}! +${comboBonus.toLocaleString()}`);
    }

    // Super ramp (3 consecutive same ramp)
    const consec = Math.max(this.consecutiveLeftRamps, this.consecutiveRightRamps);
    if (consec >= 3) {
      points += 10000;
      this.emitMessage('SUPER RAMP! +10,000!');
    }

    this.addScore(points, `${points}`, x, z);

    // Check multiball trigger
    let triggeredMultiball = false;
    if (this.ballsLocked >= this.maxLockBalls && !this.multiballActive) {
      triggeredMultiball = true;
      this.startMultiball();
    }

    // Mission progress
    if (this.currentMission?.type === 'ramp_combo' && this.currentMission.active) {
      this.advanceMission(1);
    }

    return triggeredMultiball;
  }

  handleKickback(outlaneId: string, x: number, z: number): void {
    const points = Math.floor(this.KICKBACK_BONUS * this.multiplier);
    this.addScore(points, 'KICKBACK!', x, z);
    this.emitMessage('KICKBACK SAVE!');
  }

  handleDrain(): { saved: boolean; isMultiballDrain: boolean } {
    // During multiball, losing a ball just removes it
    if (this.multiballActive) {
      this.multiballBallCount--;
      if (this.multiballBallCount <= 1) {
        this.endMultiball();
      }
      return { saved: false, isMultiballDrain: true };
    }

    // Ball saver
    if (this.ballSaverActive) {
      this.emitMessage('BALL SAVED!');
      return { saved: true, isMultiballDrain: false };
    }

    this.balls--;
    if (this.balls <= 0) {
      this.endGame();
      return { saved: false, isMultiballDrain: false };
    }

    this.currentBall++;
    this.multiplier = 1;
    this.comboCount = 0;
    this.setState('plunger');
    this.emitMessage(`BALL ${this.currentBall} - PULL TO LAUNCH!`);
    return { saved: false, isMultiballDrain: false };
  }

  // === Multiball ===

  startMultiball(): void {
    this.multiballActive = true;
    this.multiballBallCount = this.maxLockBalls + 1; // locked balls + current
    this.ballsLocked = 0;
    this.multiballJackpotActive = true;
    this.multiballJackpotValue = 25000 + (this.missionsCompleted * 5000);

    for (const cb of this.multiballCallbacks) cb(true, this.multiballBallCount);
    this.emitMessage(`MULTIBALL! ${this.multiballBallCount} BALLS!`);

    // Mission progress
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
    const jp = Math.floor(this.multiballJackpotValue * this.multiplier);
    this.addScore(jp, 'MB JACKPOT!', x, z);
    this.emitMessage(`MULTIBALL JACKPOT! +${jp.toLocaleString()}`);
    this.multiballJackpotValue += 5000;
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

    // Pick a random mission (avoid repeating)
    const available = missionDefs.filter(m =>
      !this.currentMission || m.type !== this.currentMission.type
    );
    const def = available[Math.floor(Math.random() * available.length)];

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

    const reward = Math.floor(this.currentMission.reward * this.multiplier);
    this.score += reward;
    this.emitMessage(`MISSION COMPLETE! +${reward.toLocaleString()}`);

    for (const cb of this.missionCallbacks) cb(null);

    // Next mission after cooldown
    this.currentMission = null;
    this.missionCooldown = 8 + Math.random() * 7; // 8-15 seconds
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
  }

  private addCombo(): void {
    this.comboCount++;
    this.comboTimer = this.comboTimeout;
    this.multiplier = Math.min(this.MAX_MULTIPLIER, 1 + (this.comboCount - 1) * this.COMBO_MULTIPLIER_INCREMENT);

    if (this.comboCount === 5) this.emitMessage('5x COMBO!');
    else if (this.comboCount === 10) this.emitMessage('10x COMBO! MULTIPLIER x' + this.multiplier.toFixed(1));
    else if (this.comboCount === 20) this.emitMessage('INSANE COMBO!');
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
