// Neon Pinball VR - Game State Manager
// Handles scoring, ball count, game modes, combos, and state transitions

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

export class GameManager {
  state: GameState = 'title';
  score = 0;
  balls = 3;
  maxBalls = 3;
  currentBall = 1;
  multiplier = 1;
  comboCount = 0;
  comboTimer = 0;
  comboTimeout = 2.0; // seconds to maintain combo
  totalBumperHits = 0;
  totalFlipperHits = 0;
  jackpotReady = false;
  jackpotValue = 50000;
  ballSaverActive = false;
  ballSaverTimer = 0;
  ballSaverDuration = 10; // seconds
  targets: TargetState[] = [];
  allTargetsHit = false;
  highScore = 0;
  tableName = 'Neon Classic';

  // Score values
  readonly BUMPER_SCORE = 100;
  readonly SLINGSHOT_SCORE = 50;
  readonly TARGET_SCORE = 500;
  readonly FLIPPER_SCORE = 10;
  readonly ALL_TARGETS_BONUS = 5000;
  readonly COMBO_MULTIPLIER_INCREMENT = 0.5;
  readonly MAX_MULTIPLIER = 10;

  private stateChangeCallbacks: ((state: GameState) => void)[] = [];
  private scoreCallbacks: ((score: number, label: string, x: number, z: number) => void)[] = [];
  private messageCallbacks: ((msg: string) => void)[] = [];

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

  onStateChange(cb: (state: GameState) => void): void {
    this.stateChangeCallbacks.push(cb);
  }

  onScore(cb: (score: number, label: string, x: number, z: number) => void): void {
    this.scoreCallbacks.push(cb);
  }

  onMessage(cb: (msg: string) => void): void {
    this.messageCallbacks.push(cb);
  }

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
    this.jackpotReady = false;
    this.ballSaverActive = true;
    this.ballSaverTimer = this.ballSaverDuration;
    this.allTargetsHit = false;
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
  }

  handleBumperHit(bumperId: string, x: number, z: number): void {
    this.totalBumperHits++;
    const baseScore = this.BUMPER_SCORE;
    this.addCombo();
    const points = Math.floor(baseScore * this.multiplier);
    this.addScore(points, `${points}`, x, z);

    // After 10 bumper hits, jackpot becomes ready
    if (this.totalBumperHits % 10 === 0) {
      this.jackpotReady = true;
      this.emitMessage('JACKPOT READY!');
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

    // Check all targets
    const allDown = this.targets.every(t => !t.active);
    if (allDown && !this.allTargetsHit) {
      this.allTargetsHit = true;
      points += this.ALL_TARGETS_BONUS;
      this.emitMessage('ALL TARGETS! +5000 BONUS!');
      // Reset targets after a delay
      setTimeout(() => {
        for (const t of this.targets) t.active = true;
        this.allTargetsHit = false;
      }, 3000);
    }

    this.addScore(points, allDown ? 'BONUS!' : `${points}`, x, z);
  }

  handleFlipperHit(x: number, z: number): void {
    this.totalFlipperHits++;
    const points = Math.floor(this.FLIPPER_SCORE * this.multiplier);
    if (this.jackpotReady) {
      this.jackpotReady = false;
      const jp = Math.floor(this.jackpotValue * this.multiplier);
      this.addScore(jp, 'JACKPOT!', x, z);
      this.emitMessage(`JACKPOT! +${jp.toLocaleString()}`);
      this.jackpotValue += 10000;
    }
  }

  handleDrain(): boolean {
    // Returns true if ball is saved
    if (this.ballSaverActive) {
      this.emitMessage('BALL SAVED!');
      return true;
    }

    this.balls--;
    if (this.balls <= 0) {
      this.endGame();
      return false;
    }

    this.currentBall++;
    this.multiplier = 1;
    this.comboCount = 0;
    this.setState('plunger');
    this.emitMessage(`BALL ${this.currentBall} - PULL TO LAUNCH!`);
    return false;
  }

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
