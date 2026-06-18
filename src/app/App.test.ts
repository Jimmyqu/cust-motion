import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chart, PoseFrame } from '../domain/types';

const {
  audioClocks,
  cameraSources,
  debugOverlays,
  renderers,
  simulatedSources,
  cameraStartError,
  webglSupported,
  rendererModuleLoads,
} = vi.hoisted(() => ({
  audioClocks: [] as Array<{
    currentTimeMs: number;
    state: string;
    prepare: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }>,
  cameraSources: [] as Array<{ inferenceIntervalMs?: number; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }>,
  debugOverlays: [] as Array<{ setVisible: ReturnType<typeof vi.fn>; draw: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }>,
  renderers: [] as Array<{ quality: string; render: ReturnType<typeof vi.fn>; flashHit: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }>,
  simulatedSources: [] as Array<{
    emit: (frame: PoseFrame) => void;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }>,
  cameraStartError: { current: new DOMException('Permission denied', 'NotAllowedError') as Error },
  webglSupported: { current: true },
  rendererModuleLoads: { current: 0 },
}));

const stablePose: PoseFrame = {
  timestampMs: 1_000,
  keypoints: [
    { name: 'left_shoulder', x: 0.42, y: 0.34, score: 0.98 },
    { name: 'right_shoulder', x: 0.58, y: 0.34, score: 0.98 },
    { name: 'left_hip', x: 0.44, y: 0.62, score: 0.98 },
    { name: 'right_hip', x: 0.56, y: 0.62, score: 0.98 },
    { name: 'left_wrist', x: 0.34, y: 0.48, score: 0.98 },
    { name: 'right_wrist', x: 0.66, y: 0.48, score: 0.98 },
  ],
};

vi.mock('../rendering/webglSupport', () => ({
  isWebGLSupported: () => webglSupported.current,
}));

vi.mock('../rendering/GameRenderer', () => {
  rendererModuleLoads.current += 1;
  return {
    GameRenderer: class {
      render = vi.fn();
      flashHit = vi.fn();
      dispose = vi.fn();

      constructor(_stage: HTMLElement, readonly quality = 'high') {
        renderers.push(this);
      }
    },
  };
});

vi.mock('../rendering/DebugOverlay', () => ({
  DebugOverlay: class {
    setVisible = vi.fn();
    draw = vi.fn();
    dispose = vi.fn();

    constructor() {
      debugOverlays.push(this);
    }
  },
}));

vi.mock('../infrastructure/audioClock', () => ({
  AudioClock: class {
    state = 'ready';
    currentTimeMs = 0;

    constructor(readonly durationMs: number) {
      audioClocks.push(this);
    }

    prepare = vi.fn().mockResolvedValue(undefined);
    start = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    resume = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn();
  },
}));

vi.mock('../infrastructure/immersiveDisplay', () => ({
  requestLandscapeImmersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../infrastructure/cameraPose', () => ({
  CameraPoseSource: class {
    state = { mode: 'camera' };
    start = vi.fn().mockImplementation(() => Promise.reject(cameraStartError.current));
    stop = vi.fn();

    constructor(readonly inferenceIntervalMs?: number) {
      cameraSources.push(this);
    }
  },
  SimulatedPoseSource: class {
    state = { mode: 'simulated' };
    private onFrame?: (frame: PoseFrame) => void;

    constructor() {
      simulatedSources.push(this);
    }

    start = vi.fn((onFrame: (frame: PoseFrame) => void) => {
      this.onFrame = onFrame;
      for (let index = 0; index < 70; index += 1) {
        onFrame({ ...stablePose, timestampMs: stablePose.timestampMs + index * 50 });
      }
      return Promise.resolve();
    });
    stop = vi.fn();

    emit(frame: PoseFrame) {
      this.onFrame?.(frame);
    }
  },
}));

describe('CameraRhythmSaberApp', () => {
  let animationFrames: FrameRequestCallback[];
  let nowMs: number;

  beforeEach(() => {
    vi.resetModules();
    audioClocks.length = 0;
    cameraSources.length = 0;
    debugOverlays.length = 0;
    renderers.length = 0;
    simulatedSources.length = 0;
    cameraStartError.current = new DOMException('Permission denied', 'NotAllowedError');
    webglSupported.current = true;
    rendererModuleLoads.current = 0;
    animationFrames = [];
    nowMs = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    globalThis.cancelAnimationFrame = vi.fn();
  });

  it('does not load the 3D renderer before the player starts capture', async () => {
    const { CameraRhythmSaberApp } = await import('./App');
    const root = new FakeElement('root');
    const app = new CameraRhythmSaberApp(root as unknown as HTMLElement, testChart);

    app.start();

    expect(root.innerHTML).toContain('启动前摄');
    expect(rendererModuleLoads.current).toBe(0);
    expect(renderers).toHaveLength(0);

    root.findAction('start-simulated').click();
    await flushPromises();

    expect(rendererModuleLoads.current).toBe(1);
    expect(renderers).toHaveLength(1);
    expect(root.innerHTML).toContain('开始关卡');

    app.dispose();
  });

  it('shows a recoverable Chinese camera permission error when front camera startup fails', async () => {
    const { CameraRhythmSaberApp } = await import('./App');
    const root = new FakeElement('root');
    const app = new CameraRhythmSaberApp(root as unknown as HTMLElement, testChart);

    app.start();
    root.findAction('start-camera').click();
    await flushPromises();

    expect(root.innerHTML).toContain('请允许浏览器访问前置摄像头');
    expect(root.innerHTML).toContain('重试前摄');
    expect(root.innerHTML).toContain('模拟模式');

    app.dispose();
  });

  it('shows a recoverable Chinese pose model error and can continue in simulated mode', async () => {
    cameraStartError.current = new Error('model unavailable');
    const { CameraRhythmSaberApp } = await import('./App');
    const root = new FakeElement('root');
    const app = new CameraRhythmSaberApp(root as unknown as HTMLElement, testChart);

    app.start();
    root.findAction('start-camera').click();
    await flushPromises();

    expect(root.innerHTML).toContain('姿态识别模型启动失败');
    expect(root.innerHTML).toContain('重试前摄');
    expect(root.innerHTML).toContain('模拟模式');

    root.findAction('start-simulated').click();
    await flushPromises();

    expect(root.innerHTML).toContain('开始关卡');
    expect(debugOverlays.at(-1)?.setVisible).toHaveBeenCalledWith(true);

    app.dispose();
  });

  it('shows an unsupported browser message without starting controls when WebGL is unavailable', async () => {
    webglSupported.current = false;
    const { CameraRhythmSaberApp } = await import('./App');
    const root = new FakeElement('root');
    const app = new CameraRhythmSaberApp(root as unknown as HTMLElement, testChart);

    app.start();

    expect(root.innerHTML).toContain('当前浏览器不支持 WebGL');
    expect(root.innerHTML).toContain('无法渲染 3D 游戏舞台');
    expect(root.innerHTML).not.toContain('data-action="start-camera"');
    expect(root.innerHTML).not.toContain('data-action="start-simulated"');
    expect(renderers).toHaveLength(0);
    expect(debugOverlays).toHaveLength(0);

    app.dispose();
  });

  it('releases a failed camera source before the user retries or switches mode', async () => {
    const { CameraRhythmSaberApp } = await import('./App');
    const root = new FakeElement('root');
    const app = new CameraRhythmSaberApp(root as unknown as HTMLElement, testChart);

    app.start();
    root.findAction('start-camera').click();
    await flushPromises();

    expect(cameraSources).toHaveLength(1);
    expect(cameraSources[0].stop).toHaveBeenCalledTimes(1);

    app.dispose();

    expect(cameraSources[0].stop).toHaveBeenCalledTimes(1);
  });

  it('starts low-quality camera mode with reduced pose inference and renderer quality', async () => {
    const { CameraRhythmSaberApp } = await import('./App');
    const root = new FakeElement('root');
    const app = new CameraRhythmSaberApp(root as unknown as HTMLElement, testChart);

    app.start();
    const quality = root.findAction('quality');
    quality.value = 'low';
    quality.change();
    root.findAction('start-camera').click();
    await flushPromises();

    expect(renderers.at(-1)?.quality).toBe('low');
    expect(cameraSources[0].inferenceIntervalMs).toBe(66);

    app.dispose();
  });

  it('shows the debug overlay during calibration and hides it for countdown play', async () => {
    const { CameraRhythmSaberApp } = await import('./App');
    const root = new FakeElement('root');
    const app = new CameraRhythmSaberApp(root as unknown as HTMLElement, testChart);

    app.start();
    root.findAction('start-simulated').click();
    await flushPromises();

    expect(root.innerHTML).toContain('开始关卡');
    expect(debugOverlays.at(-1)?.setVisible).toHaveBeenCalledWith(true);

    root.findAction('countdown').click();
    await flushPromises();

    expect(debugOverlays.at(-1)?.setVisible).toHaveBeenLastCalledWith(false);

    app.dispose();
  });

  it('soft-pauses on sustained tracking loss and resumes after stable recovery', async () => {
    const { CameraRhythmSaberApp } = await import('./App');
    const root = new FakeElement('root');
    const app = new CameraRhythmSaberApp(root as unknown as HTMLElement, testChart);

    app.start();
    root.findAction('start-simulated').click();
    await flushPromises();
    root.findAction('countdown').click();
    await flushPromises();
    runNextFrame(4_300);
    await flushPromises();

    expect(audioClocks[0].start).toHaveBeenCalledTimes(1);

    audioClocks[0].currentTimeMs = 1_000;
    simulatedSources[0].emit(lostPose(1_000));
    runNextFrame(4_400);
    audioClocks[0].currentTimeMs = 1_800;
    simulatedSources[0].emit(lostPose(1_800));
    runNextFrame(4_500);

    expect(audioClocks[0].pause).toHaveBeenCalledTimes(1);
    expect(root.innerHTML).toContain('data-action="resume" disabled');

    simulatedSources[0].emit(recoveredPose(2_000));
    runNextFrame(4_600);
    simulatedSources[0].emit(recoveredPose(2_900));
    runNextFrame(4_700);

    const resume = root.findAction('resume');
    expect(resume.disabled).toBe(false);

    resume.click();
    await flushPromises();

    expect(audioClocks[0].resume).toHaveBeenCalledTimes(1);
    expect(root.innerHTML).not.toContain('data-action="resume"');

    app.dispose();
  });

  function runNextFrame(timestampMs: number): void {
    nowMs = timestampMs;
    const callback = animationFrames.shift();
    if (!callback) {
      throw new Error('Missing animation frame');
    }
    callback(timestampMs);
  }
});

const testChart: Chart = {
  bpm: 120,
  durationMs: 4_000,
  events: [],
};

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

function lostPose(timestampMs: number): PoseFrame {
  return poseWithScores(timestampMs, 0.08);
}

function recoveredPose(timestampMs: number): PoseFrame {
  return poseWithScores(timestampMs, 0.98);
}

function poseWithScores(timestampMs: number, score: number): PoseFrame {
  return {
    ...stablePose,
    timestampMs,
    keypoints: stablePose.keypoints.map((point) => ({ ...point, score })),
  };
}

class FakeElement {
  className = '';
  dataset: Record<string, string> = {};
  disabled = false;
  style: Record<string, string> = {};
  textContent = '';
  value = '';
  private markup = '';
  private readonly children = new Map<string, FakeElement>();
  private readonly actions = new Map<string, FakeElement>();
  private readonly listeners = new Map<string, Array<() => void>>();

  constructor(readonly name: string) {}

  get innerHTML(): string {
    return `${this.markup}${Array.from(this.children.values()).map((child) => child.innerHTML).join('')}`;
  }

  set innerHTML(value: string) {
    this.markup = value;
    this.actions.clear();
    if (value.includes('class="stage"')) {
      this.children.set('.stage', new FakeElement('stage'));
      this.children.set('.hud', new FakeElement('hud'));
      this.children.set('.panel', new FakeElement('panel'));
    }
  }

  querySelector<T>(selector: string): T | null {
    if (this.children.has(selector)) {
      return this.children.get(selector) as T;
    }
    const action = selector.match(/^\[data-action="(.+)"\]$/)?.[1];
    if (action) {
      return this.findAction(action) as T;
    }
    return null;
  }

  querySelectorAll<T>(selector: string): T[] {
    if (selector !== '[data-action]') {
      return [];
    }

    return Array.from(this.markup.matchAll(/data-action="([^"]+)"/g)).map((match) => {
      const action = match[1];
      const element = this.actions.get(action) ?? new FakeElement(action);
      element.dataset.action = action;
      this.actions.set(action, element);
      return element as T;
    });
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  click(): void {
    this.listeners.get('click')?.forEach((listener) => listener());
  }

  change(): void {
    this.listeners.get('change')?.forEach((listener) => listener());
  }

  findAction(action: string): FakeElement {
    const panel = this.children.get('.panel') ?? this;
    const element = panel.querySelectorAll<FakeElement>('[data-action]').find((candidate) => candidate.dataset.action === action);
    if (!element) {
      throw new Error(`Missing action: ${action}`);
    }
    return element;
  }
}
