// Neon Pinball VR - UI Manager
// Manages all PanelUI entities and state transitions

import {
  PanelUI, ScreenSpace, Follower, FollowBehavior,
  PanelDocument, UIKitDocument,
} from '@iwsdk/core';

import { GameManager, GameState } from './game';
import { AudioManager } from './audio';

interface UIPanel {
  entity: any;
  doc: UIKitDocument | null;
}

export class UIManager {
  private world: any;
  private game: GameManager;
  private audio: AudioManager;

  private titlePanel: UIPanel | null = null;
  private hudPanel: UIPanel | null = null;
  private gameoverPanel: UIPanel | null = null;
  private pausePanel: UIPanel | null = null;
  private leaderboardPanel: UIPanel | null = null;
  private settingsPanel: UIPanel | null = null;
  private messagePanel: UIPanel | null = null;
  private plungerPanel: UIPanel | null = null;

  private messageTimer = 0;
  private initDone = false;

  constructor(world: any, game: GameManager, audio: AudioManager) {
    this.world = world;
    this.game = game;
    this.audio = audio;
  }

  async init(): Promise<void> {
    // Title screen (world-space, in front of table)
    this.titlePanel = await this.createWorldPanel('/ui/title.json', 0.9, 1.1, [0, 1.3, -0.8], 0.8);

    // HUD (head-following in XR)
    this.hudPanel = await this.createFollowerPanel('/ui/hud.json', 0.45, 0.08);

    // Game Over (world-space)
    this.gameoverPanel = await this.createWorldPanel('/ui/gameover.json', 0.8, 0.9, [0, 1.3, -0.8]);

    // Pause (world-space)
    this.pausePanel = await this.createWorldPanel('/ui/pause.json', 0.6, 0.6, [0, 1.3, -0.8]);

    // Leaderboard (world-space)
    this.leaderboardPanel = await this.createWorldPanel('/ui/leaderboard.json', 0.7, 1.0, [0, 1.3, -0.8]);

    // Settings (world-space)
    this.settingsPanel = await this.createWorldPanel('/ui/settings.json', 0.7, 0.9, [0, 1.3, -0.8]);

    // Message toast (head-following, below HUD)
    this.messagePanel = await this.createFollowerPanel('/ui/message.json', 0.35, 0.06, [0, -0.22, -0.5]);

    // Plunger power (head-following, right side)
    this.plungerPanel = await this.createFollowerPanel('/ui/plunger.json', 0.25, 0.08, [0.2, -0.1, -0.5]);

    // Set initial state
    this.showState('title');

    // Wait for docs to be ready, then wire events
    setTimeout(() => this.wireEvents(), 500);

    this.initDone = true;
  }

  private async createWorldPanel(
    config: string, maxWidth: number, maxHeight: number,
    position: number[], panelScale?: number,
  ): Promise<UIPanel> {
    const entity = this.world.createTransformEntity(undefined, { persistent: true });
    entity.object3D.position.set(position[0], position[1], position[2]);
    if (panelScale) entity.object3D.scale.setScalar(panelScale);
    entity.addComponent(PanelUI, { config, maxWidth, maxHeight });
    entity.object3D.visible = false;
    return { entity, doc: null };
  }

  private async createFollowerPanel(
    config: string, maxWidth: number, maxHeight: number,
    offset?: number[],
  ): Promise<UIPanel> {
    const entity = this.world.createTransformEntity(undefined, { persistent: true });
    entity.addComponent(PanelUI, { config, maxWidth, maxHeight });
    entity.addComponent(Follower, {
      target: this.world.player.head,
      offsetPosition: offset || [0.15, -0.12, -0.5],
      behavior: FollowBehavior.PivotY,
      speed: 5,
      tolerance: 0.3,
    });
    entity.object3D.visible = false;
    return { entity, doc: null };
  }

  private getDoc(panel: UIPanel): UIKitDocument | null {
    if (panel.doc) return panel.doc;
    try {
      const doc = panel.entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
      if (doc) {
        panel.doc = doc;
        return doc;
      }
    } catch {}
    return null;
  }

  private wireEvents(): void {
    // Title buttons
    const titleDoc = this.getDoc(this.titlePanel!);
    if (titleDoc) {
      titleDoc.getElementById('play-btn')?.addEventListener('click', () => {
        this.audio.init();
        this.audio.resume();
        this.audio.startAmbient();
        this.game.startGame();
      });
      titleDoc.getElementById('leaderboard-btn')?.addEventListener('click', () => {
        this.game.setState('leaderboard');
      });
      titleDoc.getElementById('settings-btn')?.addEventListener('click', () => {
        this.game.setState('settings');
      });
      // Update high score
      const hsEl = titleDoc.getElementById('highscore-value');
      if (hsEl) hsEl.text.value = this.game.highScore.toLocaleString();
    }

    // Game over buttons
    const goDoc = this.getDoc(this.gameoverPanel!);
    if (goDoc) {
      goDoc.getElementById('go-replay-btn')?.addEventListener('click', () => {
        this.game.startGame();
      });
      goDoc.getElementById('go-menu-btn')?.addEventListener('click', () => {
        this.game.setState('title');
      });
    }

    // Pause buttons
    const pauseDoc = this.getDoc(this.pausePanel!);
    if (pauseDoc) {
      pauseDoc.getElementById('resume-btn')?.addEventListener('click', () => {
        this.game.setState('playing');
      });
      pauseDoc.getElementById('quit-btn')?.addEventListener('click', () => {
        this.game.setState('title');
        this.audio.stopAmbient();
      });
    }

    // Leaderboard back
    const lbDoc = this.getDoc(this.leaderboardPanel!);
    if (lbDoc) {
      lbDoc.getElementById('lb-back-btn')?.addEventListener('click', () => {
        this.game.setState('title');
      });
    }

    // Settings
    const setDoc = this.getDoc(this.settingsPanel!);
    if (setDoc) {
      setDoc.getElementById('settings-back-btn')?.addEventListener('click', () => {
        this.game.setState('title');
      });
      this.wireVolumeControl(setDoc, 'master', () => this.audio.masterVolume, (v) => this.audio.setMasterVolume(v));
      this.wireVolumeControl(setDoc, 'sfx', () => this.audio.sfxVolume, (v) => this.audio.setSFXVolume(v));
      this.wireVolumeControl(setDoc, 'music', () => this.audio.musicVolume, (v) => this.audio.setMusicVolume(v));
    }
  }

  private wireVolumeControl(doc: UIKitDocument, prefix: string, getter: () => number, setter: (v: number) => void): void {
    const valEl = doc.getElementById(`${prefix}-val`);
    doc.getElementById(`${prefix}-down`)?.addEventListener('click', () => {
      const v = Math.max(0, getter() - 0.1);
      setter(v);
      if (valEl) valEl.text.value = `${Math.round(v * 100)}%`;
    });
    doc.getElementById(`${prefix}-up`)?.addEventListener('click', () => {
      const v = Math.min(1, getter() + 0.1);
      setter(v);
      if (valEl) valEl.text.value = `${Math.round(v * 100)}%`;
    });
  }

  showState(state: GameState | 'plunger'): void {
    const panels = [
      this.titlePanel, this.hudPanel, this.gameoverPanel,
      this.pausePanel, this.leaderboardPanel, this.settingsPanel,
      this.plungerPanel,
    ];

    // Hide all
    for (const p of panels) {
      if (p) p.entity.object3D.visible = false;
    }
    // Always hide message independently (managed by timer)

    switch (state) {
      case 'title':
        if (this.titlePanel) {
          this.titlePanel.entity.object3D.visible = true;
          const doc = this.getDoc(this.titlePanel);
          if (doc) {
            const hsEl = doc.getElementById('highscore-value');
            if (hsEl) hsEl.text.value = this.game.highScore.toLocaleString();
          }
        }
        break;

      case 'playing':
        if (this.hudPanel) this.hudPanel.entity.object3D.visible = true;
        break;

      case 'plunger':
        if (this.hudPanel) this.hudPanel.entity.object3D.visible = true;
        if (this.plungerPanel) this.plungerPanel.entity.object3D.visible = true;
        break;

      case 'gameover':
        if (this.gameoverPanel) {
          this.gameoverPanel.entity.object3D.visible = true;
          const doc = this.getDoc(this.gameoverPanel);
          if (doc) {
            const scoreEl = doc.getElementById('go-score');
            if (scoreEl) scoreEl.text.value = this.game.score.toLocaleString();
            const bumpEl = doc.getElementById('go-bumpers');
            if (bumpEl) bumpEl.text.value = String(this.game.totalBumperHits);
            const comboEl = doc.getElementById('go-combo');
            if (comboEl) comboEl.text.value = `x${this.game.multiplier.toFixed(1)}`;
            const nhEl = doc.getElementById('go-newhigh');
            if (nhEl) nhEl.text.value = this.game.score >= this.game.highScore ? 'NEW HIGH SCORE!' : '';
          }
        }
        break;

      case 'paused':
        if (this.pausePanel) {
          this.pausePanel.entity.object3D.visible = true;
          const doc = this.getDoc(this.pausePanel);
          if (doc) {
            const el = doc.getElementById('pause-score');
            if (el) el.text.value = `Score: ${this.game.score.toLocaleString()}`;
          }
        }
        break;

      case 'leaderboard':
        if (this.leaderboardPanel) {
          this.leaderboardPanel.entity.object3D.visible = true;
          this.updateLeaderboard();
        }
        break;

      case 'settings':
        if (this.settingsPanel) this.settingsPanel.entity.object3D.visible = true;
        break;
    }
  }

  private updateLeaderboard(): void {
    const doc = this.getDoc(this.leaderboardPanel!);
    if (!doc) return;
    const entries = this.game.getLeaderboard();
    for (let i = 0; i < 5; i++) {
      const scoreEl = doc.getElementById(`lb-score-${i}`);
      const dateEl = doc.getElementById(`lb-date-${i}`);
      if (i < entries.length) {
        if (scoreEl) scoreEl.text.value = entries[i].score.toLocaleString();
        if (dateEl) dateEl.text.value = new Date(entries[i].date).toLocaleDateString();
      } else {
        if (scoreEl) scoreEl.text.value = '---';
        if (dateEl) dateEl.text.value = '';
      }
    }
  }

  showMessage(msg: string): void {
    if (!this.messagePanel) return;
    this.messagePanel.entity.object3D.visible = true;
    this.messageTimer = 2.5;
    const doc = this.getDoc(this.messagePanel);
    if (doc) {
      const el = doc.getElementById('msg-text');
      if (el) el.text.value = msg;
    }
  }

  updateHUD(): void {
    const doc = this.getDoc(this.hudPanel!);
    if (!doc) return;

    const scoreEl = doc.getElementById('hud-score');
    if (scoreEl) scoreEl.text.value = this.game.score.toLocaleString();

    const ballEl = doc.getElementById('hud-ball');
    if (ballEl) ballEl.text.value = `${this.game.currentBall}/${this.game.maxBalls}`;

    const multEl = doc.getElementById('hud-multiplier');
    if (multEl) multEl.text.value = `x${this.game.multiplier.toFixed(1)}`;

    const saverEl = doc.getElementById('hud-saver');
    if (saverEl) {
      saverEl.text.value = this.game.ballSaverActive
        ? `SAVER ${Math.ceil(this.game.ballSaverTimer)}s`
        : '';
    }
  }

  updatePlungerPower(power: number): void {
    const doc = this.getDoc(this.plungerPanel!);
    if (!doc) return;
    const el = doc.getElementById('power-bar');
    if (!el) return;

    const filled = Math.floor(power * 10);
    const bar = '#'.repeat(filled) + '-'.repeat(10 - filled);
    el.text.value = bar;
  }

  update(dt: number): void {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0 && this.messagePanel) {
        this.messagePanel.entity.object3D.visible = false;
      }
    }

    // Retry event wiring if docs weren't ready
    if (this.initDone && !this.titlePanel?.doc) {
      this.wireEvents();
    }
  }
}
