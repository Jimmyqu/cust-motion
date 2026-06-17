import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chart } from '../domain/types';

const { cameraSources, debugOverlays } = vi.hoisted(() => ({
  cameraSources: [] as Array<{ inferenceIntervalMs?: number; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }>,
  debugOverlays: [] as Array<{ setVisible: ReturnType<typeof vi.fn>; draw: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }>,
}));

const stablePose = {
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
  isWebGLSupported: () => true,
}));

vi.mock('../rendering/GameRenderer', () => ({
  GameRenderer: class {
    render = vi.fn();
    flashHit = vi.fn();
    dispose = vi.fn();
  },
}));

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

    constructor(readonly durationMs: number) {}

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
    start = vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    stop = vi.fn();

    constructor(readonly inferenceIntervalMs?: number) {
      cameraSources.push(this);
    }
  },
  SimulatedPoseSource: class {
    state = { mode: 'simulated' };
    start = vi.fn((onFrame: (frame: typeof stablePose) => void) => {
      for (let index = 0; index < 70; index += 1) {
        onFrame({ ...stablePose, timestampMs: stablePose.timestampMs + index * 50 });
      }
      return Promise.resolve();
    });
    stop = vi.fn();
  },
}));

describe('CameraRhythmSaberApp', () => {
  beforeEach(() => {
    cameraSources.length = 0;
    debugOverlays.length = 0;
    globalThis.requestAnimationFrame = vi.fn(() => 1);
    globalThis.cancelAnimationFrame = vi.fn();
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
});

const testChart: Chart = {
  bpm: 120,
  durationMs: 4_000,
  events: [],
};

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

class FakeElement {
  className = '';
  dataset: Record<string, string> = {};
  disabled = false;
  style: Record<string, string> = {};
  textContent = '';
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

  findAction(action: string): FakeElement {
    const panel = this.children.get('.panel') ?? this;
    const element = panel.querySelectorAll<FakeElement>('[data-action]').find((candidate) => candidate.dataset.action === action);
    if (!element) {
      throw new Error(`Missing action: ${action}`);
    }
    return element;
  }
}
