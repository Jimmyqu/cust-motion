import { getUpcomingEvents } from '../domain/chart';
import { CalibrationReadiness, type CalibrationReadinessState } from '../domain/calibrationReadiness';
import { RhythmGameEngine } from '../domain/gameEngine';
import { MotionAnalyzer, calibratePose } from '../domain/motionAnalyzer';
import type { CalibrationProfile, Chart, MotionInput, PoseFrame } from '../domain/types';
import { AudioClock } from '../infrastructure/audioClock';
import { CameraPoseSource, SimulatedPoseSource, type PoseSource } from '../infrastructure/cameraPose';
import { requestLandscapeImmersion } from '../infrastructure/immersiveDisplay';
import { DebugOverlay } from '../rendering/DebugOverlay';
import { GameRenderer } from '../rendering/GameRenderer';
import { isWebGLSupported } from '../rendering/webglSupport';

type AppMode = 'boot' | 'permission' | 'loading' | 'calibration' | 'countdown' | 'playing' | 'paused' | 'results' | 'error';
type QualityMode = 'high' | 'low';

export class CameraRhythmSaberApp {
  private readonly stage: HTMLDivElement;
  private readonly hud: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private renderer?: GameRenderer;
  private debugOverlay?: DebugOverlay;
  private readonly audioClock: AudioClock;
  private readonly engine: RhythmGameEngine;
  private poseSource?: PoseSource;
  private latestPose?: PoseFrame;
  private latestMotion?: MotionInput;
  private calibration?: CalibrationProfile;
  private analyzer?: MotionAnalyzer;
  private calibrationReadiness = new CalibrationReadiness();
  private readinessState: CalibrationReadinessState = { ready: false, progress: 0, stableForMs: 0 };
  private mode: AppMode = 'boot';
  private quality: QualityMode = 'high';
  private readonly webglSupported = isWebGLSupported();
  private rafId?: number;
  private countdownStartedAt = 0;
  private lastFrameAt = performance.now();
  private fps = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly chart: Chart,
  ) {
    this.root.className = 'app-shell';
    this.root.innerHTML = `
      <div class="stage" aria-label="3D rhythm saber stage"></div>
      <div class="hud" aria-live="polite"></div>
      <div class="panel"></div>
    `;
    this.stage = requireElement(this.root, '.stage');
    this.hud = requireElement(this.root, '.hud');
    this.panel = requireElement(this.root, '.panel');
    if (this.webglSupported) {
      this.rebuildRenderer();
    }
    this.audioClock = new AudioClock(chart.durationMs);
    this.engine = new RhythmGameEngine(chart);
  }

  start(): void {
    this.showBoot();
    this.loop();
  }

  dispose(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
    }
    this.poseSource?.stop();
    this.audioClock.stop();
    this.renderer?.dispose();
    this.debugOverlay?.dispose();
  }

  private rebuildRenderer(): void {
    this.renderer?.dispose();
    this.debugOverlay?.dispose();
    this.renderer = new GameRenderer(this.stage, this.quality);
    this.debugOverlay = new DebugOverlay(this.stage);
    this.debugOverlay.setVisible(false);
  }

  private showBoot(): void {
    this.mode = 'boot';
    this.debugOverlay?.setVisible(false);
    this.hud.innerHTML = '';
    if (!this.webglSupported) {
      this.showError('当前浏览器不支持 WebGL，无法渲染 3D 游戏舞台。请换用支持 WebGL 的移动浏览器。');
      return;
    }
    this.panel.innerHTML = `
      <section class="panel-card wide">
        <p class="eyebrow">Cust Motion</p>
        <h1>Camera Rhythm Saber</h1>
        <p class="subtitle">手机横屏全屏运行，前摄捕捉上半身动作，镜像投屏到电视游玩。</p>
        <div class="action-row">
          <button class="primary" data-action="start-camera">启动前摄</button>
          <button data-action="start-simulated">无摄像头模拟</button>
        </div>
        <div class="settings-row">
          <label>
            画质
            <select data-action="quality">
              <option value="high">高画质</option>
              <option value="low">低画质</option>
            </select>
          </label>
        </div>
      </section>
    `;
    this.bindPanelActions();
  }

  private async startCamera(): Promise<void> {
    void this.enterLandscapeImmersion();
    this.mode = 'permission';
    this.panel.innerHTML = `<section class="panel-card"><h2>正在请求前摄权限</h2><p class="subtitle">请允许浏览器访问前置摄像头。</p></section>`;
    try {
      await this.initializePoseSource(new CameraPoseSource(this.quality === 'low' ? 66 : 40));
    } catch (error) {
      this.showError(`前置摄像头或姿态模型启动失败：${readableError(error)}`);
    }
  }

  private async startSimulated(): Promise<void> {
    void this.enterLandscapeImmersion();
    await this.initializePoseSource(new SimulatedPoseSource());
  }

  private async initializePoseSource(source: PoseSource, warning?: string): Promise<void> {
    this.mode = 'loading';
    this.poseSource?.stop();
    this.poseSource = source;
    this.panel.innerHTML = `<section class="panel-card"><h2>正在加载姿态识别</h2><p class="subtitle">${warning ? `${warning} 已切换到模拟姿态。` : '准备校准骨架。'}</p></section>`;
    try {
      await source.start((frame) => this.onPoseFrame(frame));
      this.showCalibration(warning);
    } catch (error) {
      this.showError(readableError(error));
    }
  }

  private onPoseFrame(frame: PoseFrame): void {
    this.latestPose = frame;
    if (!this.calibration) {
      try {
        this.calibration = calibratePose(frame);
        this.analyzer = new MotionAnalyzer(this.calibration, {
          smoothing: this.quality === 'low' ? 0.45 : 0.32,
        });
        this.calibrationReadiness.reset();
      } catch {
        return;
      }
    }
    this.latestMotion = this.analyzer?.analyze(frame);
    if (this.latestMotion) {
      this.readinessState = this.calibrationReadiness.update(this.latestMotion);
      if (this.mode === 'calibration') {
        this.updateCalibrationPanel();
      }
    }
  }

  private showCalibration(warning?: string): void {
    this.mode = 'calibration';
    this.debugOverlay?.setVisible(true);
    this.renderCalibrationPanel(warning);
    this.bindPanelActions();
  }

  private updateCalibrationPanel(): void {
    const progress = this.panel.querySelector<HTMLElement>('[data-calibration-progress]');
    const status = this.panel.querySelector<HTMLElement>('[data-calibration-status]');
    const start = this.panel.querySelector<HTMLButtonElement>('[data-action="countdown"]');
    if (!progress || !status || !start) {
      return;
    }
    progress.style.width = `${Math.round(this.readinessState.progress * 100)}%`;
    status.textContent = this.readinessState.ready
      ? '追踪稳定，可以开始关卡。'
      : `保持站姿，正在确认稳定追踪 ${Math.round(this.readinessState.progress * 100)}%`;
    start.disabled = !this.readinessState.ready;
  }

  private renderCalibrationPanel(warning?: string): void {
    this.panel.innerHTML = `
      <section class="panel-card compact">
        <p class="eyebrow">校准 / 调试</p>
        <h2>站入画面中央</h2>
        <p class="subtitle">调试时显示镜像摄像头、骨架、关键点、手部轨迹和识别指标。</p>
        <div class="calibration-meter" aria-label="追踪稳定度">
          <span data-calibration-progress></span>
        </div>
        <p class="calibration-status" data-calibration-status>等待肩膀、髋部和双手进入画面。</p>
        ${warning ? `<p class="warning">${warning}</p>` : ''}
        <div class="action-row">
          <button class="primary" data-action="countdown" disabled>开始关卡</button>
          <button data-action="recalibrate">重新校准</button>
          <button data-action="fullscreen">全屏</button>
        </div>
      </section>
    `;
    this.updateCalibrationPanel();
  }

  private beginCountdown(): void {
    void this.enterLandscapeImmersion();
    this.mode = 'countdown';
    this.debugOverlay?.setVisible(false);
    this.countdownStartedAt = performance.now();
    this.panel.innerHTML = `<section class="countdown" data-countdown>3</section>`;
  }

  private async beginPlay(): Promise<void> {
    this.mode = 'playing';
    this.debugOverlay?.setVisible(false);
    this.panel.innerHTML = '';
    await this.audioClock.start();
  }

  private showPaused(): void {
    this.mode = 'paused';
    this.audioClock.pause();
    this.panel.innerHTML = `
      <section class="panel-card compact">
        <p class="eyebrow">追踪丢失</p>
        <h2>回到镜头中</h2>
        <p class="subtitle">站回有效区域后可继续，或返回校准查看骨架。</p>
        <div class="action-row">
          <button class="primary" data-action="resume">继续</button>
          <button data-action="calibration">校准</button>
        </div>
      </section>
    `;
    this.bindPanelActions();
  }

  private async resumePlay(): Promise<void> {
    this.mode = 'playing';
    this.panel.innerHTML = '';
    await this.audioClock.resume();
  }

  private showResults(): void {
    this.mode = 'results';
    this.audioClock.stop();
    this.debugOverlay?.setVisible(false);
    const state = this.engine.state;
    const hitRate = state.hits + state.misses === 0 ? 0 : Math.round((state.hits / (state.hits + state.misses)) * 100);
    this.panel.innerHTML = `
      <section class="panel-card wide">
        <p class="eyebrow">结算</p>
        <h1>${ratingFor(state.score, state.health)}</h1>
        <div class="result-grid">
          <span>分数 <strong>${state.score}</strong></span>
          <span>最高连击 <strong>${state.maxCombo}</strong></span>
          <span>命中率 <strong>${hitRate}%</strong></span>
          <span>障碍碰撞 <strong>${state.obstacleCollisions}</strong></span>
        </div>
        <div class="action-row">
          <button class="primary" data-action="restart">再来一局</button>
          <button data-action="calibration">校准</button>
        </div>
      </section>
    `;
    this.bindPanelActions();
  }

  private showError(message: string): void {
    this.mode = 'error';
    this.panel.innerHTML = `
      <section class="panel-card wide">
        <p class="eyebrow">错误</p>
        <h1>无法启动</h1>
        <p class="subtitle">${message}</p>
        <div class="action-row">
          <button class="primary" data-action="start-camera">重试前摄</button>
          <button data-action="start-simulated">模拟模式</button>
        </div>
      </section>
    `;
    this.bindPanelActions();
  }

  private bindPanelActions(): void {
    this.panel.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => {
      element.addEventListener('click', () => void this.handleAction(element.dataset.action ?? '', element));
      element.addEventListener('change', () => void this.handleAction(element.dataset.action ?? '', element));
    });
  }

  private async handleAction(action: string, element: HTMLElement): Promise<void> {
    switch (action) {
      case 'start-camera':
        await this.startCamera();
        break;
      case 'start-simulated':
        await this.startSimulated();
        break;
      case 'quality':
        this.quality = (element as HTMLSelectElement).value === 'low' ? 'low' : 'high';
        this.rebuildRenderer();
        break;
      case 'fullscreen':
        await this.enterLandscapeImmersion();
        break;
      case 'countdown':
        if (this.readinessState.ready) {
          this.beginCountdown();
        }
        break;
      case 'recalibrate':
        this.calibration = undefined;
        this.analyzer = undefined;
        this.calibrationReadiness.reset();
        this.readinessState = { ready: false, progress: 0, stableForMs: 0 };
        this.showCalibration();
        break;
      case 'calibration':
        this.audioClock.pause();
        this.showCalibration();
        break;
      case 'resume':
        await this.resumePlay();
        break;
      case 'restart':
        window.location.reload();
        break;
    }
  }

  private loop = (): void => {
    const now = performance.now();
    const delta = now - this.lastFrameAt;
    this.lastFrameAt = now;
    this.fps = this.fps === 0 ? 1000 / delta : this.fps * 0.9 + (1000 / delta) * 0.1;

    if (this.mode === 'calibration') {
      this.debugOverlay?.draw(this.poseSource?.state.video, this.latestPose, this.latestMotion, this.fps);
    }

    if (this.mode === 'countdown') {
      const left = Math.max(0, 3 - Math.floor((now - this.countdownStartedAt) / 1000));
      const node = this.panel.querySelector('[data-countdown]');
      if (node) {
        node.textContent = left === 0 ? 'GO' : String(left);
      }
      if (now - this.countdownStartedAt > 3_200) {
        void this.beginPlay();
      }
    }

    if (this.mode === 'playing') {
      const time = this.audioClock.currentTimeMs;
      const upcoming = getUpcomingEvents(this.chart, Math.max(0, time - 300), 2_600);
      const feedback = this.latestMotion ? this.engine.update(time, this.latestMotion) : undefined;
      for (const hit of feedback?.hits ?? []) {
        const event = this.chart.events.find((candidate) => candidate.id === hit.eventId);
        if (event?.kind === 'target') {
      this.renderer?.flashHit(event.hand);
        }
      }
      this.renderer?.render(time, this.latestMotion, upcoming);
      this.renderHud(time);
      if (feedback?.status === 'tracking-lost') {
        this.showPaused();
      } else if (feedback?.status === 'finished' || this.audioClock.state === 'ended') {
        this.showResults();
      }
    } else {
      const previewTime = (now % this.chart.durationMs);
      this.renderer?.render(previewTime, this.latestMotion, getUpcomingEvents(this.chart, previewTime, 2_600));
      this.renderHud(previewTime, true);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private renderHud(timeMs: number, preview = false): void {
    const state = this.engine.state;
    this.hud.innerHTML = `
      <div class="hud-pill">${preview ? 'PREVIEW' : 'PLAY'} ${Math.round(timeMs / 1000)}s</div>
      <div class="hud-center">${state.combo} COMBO</div>
      <div class="hud-pill">${state.score} pts · HP ${state.health}</div>
      <div class="tracking-dot ${this.latestMotion?.trackingQuality ?? 'lost'}"></div>
      <div class="progress-track" aria-label="关卡进度">
        <span style="width: ${Math.round(Math.min(1, timeMs / this.chart.durationMs) * 100)}%"></span>
      </div>
    `;
  }

  private async enterLandscapeImmersion(): Promise<void> {
    await requestLandscapeImmersion();
  }
}

function requireElement<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing app element: ${selector}`);
  }
  return element;
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ratingFor(score: number, health: number): string {
  if (health <= 0) {
    return 'FAILED';
  }
  if (score > 2_800) {
    return 'S RANK';
  }
  if (score > 1_800) {
    return 'A RANK';
  }
  return 'B RANK';
}
