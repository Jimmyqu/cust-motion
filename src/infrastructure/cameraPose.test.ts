import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createFromOptions, forVisionTasks } = vi.hoisted(() => ({
  createFromOptions: vi.fn(),
  forVisionTasks: vi.fn(),
}));

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks,
  },
  PoseLandmarker: {
    createFromOptions,
  },
}));

describe('CameraPoseSource', () => {
  const originalNavigator = globalThis.navigator;
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    vi.resetModules();
    forVisionTasks.mockReset();
    createFromOptions.mockReset();
    globalThis.requestAnimationFrame = vi.fn(() => 1);
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setGlobal('navigator', originalNavigator);
    setGlobal('document', originalDocument);
    globalThis.requestAnimationFrame = originalAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('releases the camera stream and temporary video if pose model loading fails', async () => {
    const { stop, remove } = installCameraEnvironment();
    forVisionTasks.mockRejectedValue(new Error('model unavailable'));
    const { CameraPoseSource } = await import('./cameraPose');
    const source = new CameraPoseSource();

    await expect(source.start(vi.fn())).rejects.toThrow('model unavailable');

    expect(stop).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);

    source.stop();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('falls back to CPU pose inference if GPU delegate creation fails', async () => {
    installCameraEnvironment();
    const landmarker = { close: vi.fn(), detectForVideo: vi.fn() };
    forVisionTasks.mockResolvedValue('vision');
    createFromOptions.mockRejectedValueOnce(new Error('GPU unavailable')).mockResolvedValueOnce(landmarker as never);
    const { CameraPoseSource } = await import('./cameraPose');
    const source = new CameraPoseSource();

    await source.start(vi.fn());

    expect(createFromOptions).toHaveBeenCalledTimes(2);
    expect(createFromOptions.mock.calls[0]?.[1].baseOptions.delegate).toBe('GPU');
    expect(createFromOptions.mock.calls[1]?.[1].baseOptions.delegate).toBe('CPU');
  });
});

function installCameraEnvironment(): { stop: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } {
  const stop = vi.fn();
  const remove = vi.fn();
  const video = {
    muted: false,
    playsInline: false,
    autoplay: false,
    style: { display: '' },
    readyState: 2,
    play: vi.fn().mockResolvedValue(undefined),
    remove,
  };
  const stream = {
    getTracks: () => [{ stop }],
  };
  setGlobal('document', {
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => video),
  });
  setGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(stream),
    },
  });
  return { stop, remove };
}

function setGlobal(key: 'document' | 'navigator', value: unknown): void {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value,
  });
}
