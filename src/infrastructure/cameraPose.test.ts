import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const forVisionTasks = vi.fn();

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks,
  },
  PoseLandmarker: {
    createFromOptions: vi.fn(),
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
    const stop = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const video = {
      muted: false,
      playsInline: false,
      autoplay: false,
      style: { display: '' },
      play: vi.fn().mockResolvedValue(undefined),
      remove,
    };
    const stream = {
      getTracks: () => [{ stop }],
    };
    setGlobal('document', {
      body: { appendChild },
      createElement: vi.fn(() => video),
    });
    setGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });
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
});

function setGlobal(key: 'document' | 'navigator', value: unknown): void {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value,
  });
}
