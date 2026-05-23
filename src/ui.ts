// Neon Pinball VR - UI Manager
// Round 3: Achievements panel, stats panel, wizard HUD, achievement toast, dynamic updates

import {
  PanelUI, ScreenSpace, Follower, FollowBehavior,
  PanelDocument, UIKitDocument,
} from '@iwsdk/core';

import { GameManager, GameState, Mission, IntensityLevel, BonusCountdown } from './game';
import { AudioManager } from './audio';
import { AchievementManager, Achievement } from './achievements';

interface UIPanel {
  entity: any;
  doc: UIKitDocument | null;
}

export class UIManager {
  private world: any;
  private game: GameManager;
  private audio: AudioManager;
  private achievements: AchievementManager;

  private titlePanel: UIPanel | null = null;
  private hudPanel: UIPanel | null = null;
  private gameoverPanel: UIPanel | null = null;
  private pausePanel: UIPanel | null = null;
  private leaderboardPanel: UIPanel | null = null;
  private settingsPanel: UIPanel | null = null;
  private messagePanel: UIPanel | null = null;
  private plungerPanel: UIPanel | null = null;
  private missionPanel: UIPanel | null = null;
  private achievementsPanel: UIPanel | null = null;
  private statsPanel: UIPanel | null = null;
  private wizardPanel: UIPanel | null = null;
  private achToastPanel: UIPanel | null = null;
  private controlsPanel: UIPanel | null = null;
  private bonusPanel: UIPanel | null = null;

  private messageTimer = 0;
  private achToastTimer = 0;
  private achToastQueue: Achievement[] = [];
  private comboTierDisplay = '';
  private bonusCountdownTimer = 0;
  private initDone = false;

  constructor(world: any, game: GameManager, audio: AudioManager, achievements: AchievementManager) {
    this.world = world;
    this.game = game;
    this.audio = audio;
    this.achievements = achievements;
  }

  async init(): Promise<void> {
    // Title screen
    this.titlePanel = await this.createWorldPanel('/ui/title.json', 0.9, 1.2, [0, 1.3, -0.8], 0.8);

    // HUD (head-following)
    this.hudPanel = await this.createFollowerPanel('/ui/hud.json', 0.55, 0.08);

    // Game Over
    this.gameoverPanel = await this.createWorldPanel('/ui/gameover.json', 0.8, 1.0, [0, 1.3, -0.8]);

    // Pause
    this.pausePanel = await this.createWorldPanel('/ui/pause.json', 0.6, 0.6, [0, 1.3, -0.8]);

    // Leaderboard
    this.leaderboardPanel = await this.createWorldPanel('/ui/leaderboard.json', 0.7, 1.0, [0, 1.3, -0.8]);

    // Settings
    this.settingsPanel = await this.createWorldPanel('/ui/settings.json', 0.7, 0.9, [0, 1.3, -0.8]);

    // Achievements
    this.achievementsPanel = await this.createWorldPanel('/ui/achievements.json', 0.8, 1.2, [0, 1.3, -0.8]);

    // Stats
    this.statsPanel = await this.createWorldPanel('/ui/stats.json', 0.7, 1.1, [0, 1.3, -0.8]);

    // Message toast
    this.messagePanel = await this.createFollowerPanel('/ui/message.json', 0.35, 0.06, [0, -0.22, -0.5]);

    // Plunger power
    this.plungerPanel = await this.createFollowerPanel('/ui/plunger.json', 0.25, 0.08, [0.2, -0.1, -0.5]);

    // Mission panel (head-following, left side)
    this.missionPanel = await this.createFollowerPanel('/ui/mission.json', 0.25, 0.1, [-0.22, -0.1, -0.5]);

    // Wizard mode HUD (head-following, right side)
    this.wizardPanel = await this.createFollowerPanel('/ui/wizard.json', 0.2, 0.08, [0.22, -0.05, -0.5]);

    // Achievement toast (head-following, bottom-right)
    this.achToastPanel = await this.createFollowerPanel('/ui/achtoast.json', 0.35, 0.07, [0.15, -0.25, -0.5]);

    // Controls/Help panel
    this.controlsPanel = await this.createWorldPanel('/ui/controls.json', 0.8, 1.3, [0, 1.3, -0.8], 0.8);

    // Bonus countdown panel (head-following)
    this.bonusPanel = await this.createFollowerPanel('/ui/bonus.json', 0.3, 0.15, [0, -0.1, -0.5]);

    // Initial state
    this.showState('title');

    // Wire events after docs ready
    setTimeout(() => this.wireEvents(), 500);

    // Wire mission updates
    this.game.onMission((mission) => this.updateMissionPanel(mission));

    // Wire wizard mode
    this.game.onWizardMode((active) => {
      if (this.wizardPanel) this.wizardPanel.entity.object3D.visible = active;
      if (active) this.audio.playWizardModeStart();
      else this.audio.playWizardModeEnd();
    });

    // Wire extra ball
    this.game.onExtraBall(() => {
      this.audio.playExtraBall();
    });

    // Wire intensity
    this.game.onIntensity((level: IntensityLevel) => {
      this.audio.setIntensity(level);
    });

    // Wire achievement unlocks
    this.achievements.onUnlock((ach) => {
      this.queueAchievementToast(ach);
      this.audio.playAchievementUnlock();
    });

    // Wire combo tier display
    this.game.onComboTier((tier: string) => {
      this.comboTierDisplay = tier;
    });

    // Wire bonus countdown
    this.game.onBonus((data: BonusCountdown) => {
      this.showBonusCountdown(data);
    });

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
        this.achievements.startGame();
      });
      titleDoc.getElementById('leaderboard-btn')?.addEventListener('click', () => {
        this.game.setState('leaderboard');
      });
      titleDoc.getElementById('settings-btn')?.addEventListener('click', () => {
        this.game.setState('settings');
      });
      titleDoc.getElementById('achievements-btn')?.addEventListener('click', () => {
        this.game.setState('achievements');
      });
      titleDoc.getElementById('stats-btn')?.addEventListener('click', () => {
        this.game.setState('stats');
      });
      titleDoc.getElementById('controls-btn')?.addEventListener('click', () => {
        this.game.setState('controls');
      });
      const hsEl = titleDoc.getElementById('highscore-value');
      if (hsEl) hsEl.text.value = this.game.highScore.toLocaleString();
      this.updateTitleAchCount(titleDoc);
    }

    // Game over buttons
    const goDoc = this.getDoc(this.gameoverPanel!);
    if (goDoc) {
      goDoc.getElementById('go-replay-btn')?.addEventListener('click', () => {
        this.game.startGame();
        this.achievements.startGame();
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

    // Achievements back
    const achDoc = this.getDoc(this.achievementsPanel!);
    if (achDoc) {
      achDoc.getElementById('ach-back-btn')?.addEventListener('click', () => {
        this.game.setState('title');
      });
    }

    // Stats back
    const statsDoc = this.getDoc(this.statsPanel!);
    if (statsDoc) {
      statsDoc.getElementById('stats-back-btn')?.addEventListener('click', () => {
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

    // Controls/Help back
    const ctrlDoc = this.getDoc(this.controlsPanel!);
    if (ctrlDoc) {
      ctrlDoc.getElementById('controls-back-btn')?.addEventListener('click', () => {
        this.game.setState('title');
      });
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

  private updateTitleAchCount(doc: UIKitDocument): void {
    const el = doc.getElementById('ach-count-display');
    if (el) {
      const unlocked = this.achievements.getUnlockedCount();
      const total = this.achievements.getTotalCount();
      el.text.value = unlocked > 0 ? `${unlocked}/${total} Achievements Unlocked` : '';
    }
  }

  showState(state: GameState | 'plunger'): void {
    const panels = [
      this.titlePanel, this.hudPanel, this.gameoverPanel,
      this.pausePanel, this.leaderboardPanel, this.settingsPanel,
      this.plungerPanel, this.achievementsPanel, this.statsPanel,
      this.controlsPanel, this.bonusPanel,
    ];

    for (const p of panels) {
      if (p) p.entity.object3D.visible = false;
    }

    // Hide mission/wizard panel when not playing
    if (state !== 'playing' && state !== 'plunger') {
      if (this.missionPanel) this.missionPanel.entity.object3D.visible = false;
      if (this.wizardPanel) this.wizardPanel.entity.object3D.visible = false;
    }

    switch (state) {
      case 'title':
        if (this.titlePanel) {
          this.titlePanel.entity.object3D.visible = true;
          const doc = this.getDoc(this.titlePanel);
          if (doc) {
            const hsEl = doc.getElementById('highscore-value');
            if (hsEl) hsEl.text.value = this.game.highScore.toLocaleString();
            this.updateTitleAchCount(doc);
          }
        }
        break;

      case 'playing':
        if (this.hudPanel) this.hudPanel.entity.object3D.visible = true;
        if (this.missionPanel && this.game.currentMission?.active) {
          this.missionPanel.entity.object3D.visible = true;
        }
        if (this.wizardPanel && this.game.wizardModeActive) {
          this.wizardPanel.entity.object3D.visible = true;
        }
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
            const rampEl = doc.getElementById('go-ramps');
            if (rampEl) rampEl.text.value = String(this.game.totalRampShots);
            const comboEl = doc.getElementById('go-combo');
            if (comboEl) comboEl.text.value = `x${this.game.multiplier.toFixed(1)}`;
            const missEl = doc.getElementById('go-missions');
            if (missEl) missEl.text.value = String(this.game.missionsCompleted);
            const wizEl = doc.getElementById('go-wizard');
            if (wizEl) wizEl.text.value = this.game.wizardModeTriggered ? 'YES!' : 'No';
            const nhEl = doc.getElementById('go-newhigh');
            if (nhEl) nhEl.text.value = this.game.score >= this.game.highScore ? 'NEW HIGH SCORE!' : '';
          }
        }
        // Report to achievements
        this.achievements.endGame(
          this.game.score,
          this.game.totalBumperHits,
          this.game.multiplier,
        );
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

      case 'achievements':
        if (this.achievementsPanel) {
          this.achievementsPanel.entity.object3D.visible = true;
          this.updateAchievementsPanel();
        }
        break;

      case 'stats':
        if (this.statsPanel) {
          this.statsPanel.entity.object3D.visible = true;
          this.updateStatsPanel();
        }
        break;

      case 'controls':
        if (this.controlsPanel) {
          this.controlsPanel.entity.object3D.visible = true;
        }
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

  private updateAchievementsPanel(): void {
    const doc = this.getDoc(this.achievementsPanel!);
    if (!doc) return;

    const countEl = doc.getElementById('ach-count');
    if (countEl) {
      countEl.text.value = `${this.achievements.getUnlockedCount()} / ${this.achievements.getTotalCount()}`;
    }

    // Update displayed achievements (first 8 shown in panel)
    for (let i = 0; i < 8 && i < this.achievements.achievements.length; i++) {
      const ach = this.achievements.achievements[i];
      const nameEl = doc.getElementById(`ach-name-${i}`);
      const descEl = doc.getElementById(`ach-desc-${i}`);
      const iconEl = doc.getElementById(`ach-icon-${i}`);

      if (nameEl) nameEl.text.value = ach.unlocked ? ach.name : '???';
      if (descEl) descEl.text.value = ach.unlocked ? ach.description : 'Locked';
      if (iconEl) iconEl.text.value = ach.unlocked ? ach.icon : '🔒';
    }
  }

  private updateStatsPanel(): void {
    const doc = this.getDoc(this.statsPanel!);
    if (!doc) return;

    const s = this.achievements.stats;
    const setEl = (id: string, val: string) => {
      const el = doc.getElementById(id);
      if (el) el.text.value = val;
    };

    setEl('stat-games', String(s.totalGames));
    setEl('stat-best', s.bestScore.toLocaleString());
    setEl('stat-total', s.totalScore.toLocaleString());
    setEl('stat-combo', `x${s.bestCombo.toFixed(1)}`);
    setEl('stat-bumpers', s.totalBumperHits.toLocaleString());
    setEl('stat-ramps', s.totalRampShots.toLocaleString());
    setEl('stat-multi', String(s.totalMultiballs));
    setEl('stat-missions', String(s.totalMissionsCompleted));
    setEl('stat-wizard', String(s.totalWizardModes));
    setEl('stat-extraballs', String(s.totalExtraBalls));

    const hrs = Math.floor(s.totalPlayTimeSeconds / 3600);
    const mins = Math.floor((s.totalPlayTimeSeconds % 3600) / 60);
    setEl('stat-time', `${hrs}h ${mins}m`);
  }

  private updateMissionPanel(mission: Mission | null): void {
    if (!this.missionPanel) return;

    if (!mission) {
      this.missionPanel.entity.object3D.visible = false;
      return;
    }

    this.missionPanel.entity.object3D.visible = true;
    const doc = this.getDoc(this.missionPanel);
    if (!doc) return;

    const nameEl = doc.getElementById('mission-name');
    if (nameEl) nameEl.text.value = mission.name;

    const progEl = doc.getElementById('mission-progress');
    if (progEl) progEl.text.value = `${mission.progress}/${mission.target}`;

    const descEl = doc.getElementById('mission-desc');
    if (descEl) descEl.text.value = mission.description;
  }

  // Achievement toast queue
  private queueAchievementToast(ach: Achievement): void {
    this.achToastQueue.push(ach);
    if (this.achToastTimer <= 0) {
      this.showNextAchToast();
    }
  }

  private showNextAchToast(): void {
    if (this.achToastQueue.length === 0) {
      if (this.achToastPanel) this.achToastPanel.entity.object3D.visible = false;
      return;
    }

    const ach = this.achToastQueue.shift()!;
    if (!this.achToastPanel) return;

    this.achToastPanel.entity.object3D.visible = true;
    this.achToastTimer = 3.0;

    const doc = this.getDoc(this.achToastPanel);
    if (doc) {
      const iconEl = doc.getElementById('ach-toast-icon');
      if (iconEl) iconEl.text.value = ach.icon;
      const nameEl = doc.getElementById('ach-toast-name');
      if (nameEl) nameEl.text.value = ach.name;
    }
  }

  // Bonus countdown
  private showBonusCountdown(data: BonusCountdown): void {
    if (!this.bonusPanel) return;
    this.bonusPanel.entity.object3D.visible = true;
    this.bonusCountdownTimer = 3.0;

    const doc = this.getDoc(this.bonusPanel);
    if (!doc) return;

    const setEl = (id: string, val: string) => {
      const el = doc.getElementById(id);
      if (el) el.text.value = val;
    };

    setEl('bonus-bumpers', `${data.bumperHits} × 50 = ${(data.bumperHits * 50).toLocaleString()}`);
    setEl('bonus-ramps', `${data.rampShots} × 300 = ${(data.rampShots * 300).toLocaleString()}`);
    setEl('bonus-spinners', `${data.spinnerHits} × 25 = ${(data.spinnerHits * 25).toLocaleString()}`);
    setEl('bonus-missions', `${data.missions} × 5,000 = ${(data.missions * 5000).toLocaleString()}`);
    setEl('bonus-combo', `x${data.maxCombo} = ${(data.maxCombo * 500).toLocaleString()}`);
    setEl('bonus-jackpots', `${data.jackpots} × 2,000 = ${(data.jackpots * 2000).toLocaleString()}`);
    setEl('bonus-total', data.totalBonus.toLocaleString());
    setEl('bonus-tick', 'BONUS AWARDED');

    this.audio.playBonusTotal();
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
    if (ballEl) {
      const extraStr = this.game.extraBallPending ? '+1' : '';
      ballEl.text.value = `${this.game.currentBall}/${this.game.maxBalls}${extraStr}`;
    }

    const multEl = doc.getElementById('hud-multiplier');
    if (multEl) {
      const eff = this.game.wizardModeActive
        ? this.game.multiplier * this.game.wizardModeMultiplier
        : this.game.multiplier;
      multEl.text.value = `x${eff.toFixed(1)}`;
    }

    const saverEl = doc.getElementById('hud-saver');
    if (saverEl) {
      saverEl.text.value = this.game.ballSaverActive
        ? `SAVER ${Math.ceil(this.game.ballSaverTimer)}s`
        : '';
    }

    const mbEl = doc.getElementById('hud-multiball');
    if (mbEl) {
      mbEl.text.value = this.game.multiballActive
        ? `MULTIBALL ${this.game.multiballBallCount}x`
        : this.game.ballsLocked > 0
          ? `LOCK ${this.game.ballsLocked}/${this.game.maxLockBalls}`
          : '';
    }

    const extraEl = doc.getElementById('hud-extra');
    if (extraEl) {
      extraEl.text.value = this.game.extraBallPending ? 'EXTRA BALL!' : '';
    }

    const wizEl = doc.getElementById('hud-wizard');
    if (wizEl) {
      wizEl.text.value = this.game.wizardModeActive
        ? `WIZARD ${Math.ceil(this.game.wizardModeTimer)}s`
        : '';
    }

    // Combo tier display
    const tierEl = doc.getElementById('hud-combo-tier');
    if (tierEl) {
      tierEl.text.value = this.comboTierDisplay;
    }

    // Super jackpot indicator
    const sjEl = doc.getElementById('hud-superjp');
    if (sjEl) {
      sjEl.text.value = this.game.superJackpotCharged ? 'SUPER JP!' : '';
    }

    // Update wizard panel timer
    if (this.game.wizardModeActive && this.wizardPanel) {
      const wDoc = this.getDoc(this.wizardPanel);
      if (wDoc) {
        const timerEl = wDoc.getElementById('wizard-timer');
        if (timerEl) timerEl.text.value = `${Math.ceil(this.game.wizardModeTimer)}s`;
      }
    }

    // Achievement checks during play
    this.achievements.checkCombo(this.game.multiplier);
    this.achievements.checkBallOneScore(this.game.score, this.game.currentBall);
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

    // Achievement toast timer
    if (this.achToastTimer > 0) {
      this.achToastTimer -= dt;
      if (this.achToastTimer <= 0) {
        this.showNextAchToast();
      }
    }

    // Bonus countdown timer
    if (this.bonusCountdownTimer > 0) {
      this.bonusCountdownTimer -= dt;
      if (this.bonusCountdownTimer <= 0 && this.bonusPanel) {
        this.bonusPanel.entity.object3D.visible = false;
      }
    }

    if (this.initDone && !this.titlePanel?.doc) {
      this.wireEvents();
    }
  }
}
