import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioClock } from './audioClock';

class FakeAudioParam {
  value = 0;

  setValueAtTime(value: number): void {
    this.value = value;
  }

  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam();
  connect = vi.fn();
}

class FakeOscillatorNode {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeAudioParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = 'running';
  readonly destination = {};
  readonly close = vi.fn(async () => undefined);
  readonly resume = vi.fn(async () => undefined);
  readonly suspend = vi.fn(async () => undefined);

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  createOscillator(): FakeOscillatorNode {
    return new FakeOscillatorNode();
  }
}

describe('AudioClock', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('prepares audio from a user gesture and reuses it when playback starts', async () => {
    const contexts: FakeAudioContext[] = [];
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        constructor() {
          super();
          contexts.push(this);
        }
      },
    );
    vi.stubGlobal('window', {
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });

    const clock = new AudioClock(1_000);

    await clock.prepare();
    await clock.start();

    expect(contexts).toHaveLength(1);
    expect(clock.state).toBe('running');
  });

  it('does not block preparation when mobile audio resume remains pending', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        override state: AudioContextState = 'suspended';
        override resume = vi.fn(() => new Promise<void>(() => undefined));
      },
    );

    const clock = new AudioClock(1_000);
    const prepared = vi.fn();
    const preparePromise = clock.prepare().then(prepared);

    await vi.advanceTimersByTimeAsync(350);
    await preparePromise;

    expect(prepared).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('advances game time from the wall clock when audio time is still suspended', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        override currentTime = 0;
        override state: AudioContextState = 'suspended';
        override resume = vi.fn(() => new Promise<void>(() => undefined));
      },
    );
    vi.stubGlobal('window', {
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });

    const clock = new AudioClock(1_000);

    await clock.start();
    await vi.advanceTimersByTimeAsync(450);

    expect(clock.currentTimeMs).toBe(450);
    vi.useRealTimers();
  });

  it('does not move game time backward when audio unlocks after fallback timing advanced', async () => {
    vi.useFakeTimers();
    const contexts: FakeAudioContext[] = [];
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        override currentTime = 0;
        override state: AudioContextState = 'suspended';

        constructor() {
          super();
          contexts.push(this);
        }
      },
    );
    vi.stubGlobal('window', {
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });

    const clock = new AudioClock(2_000);

    await clock.start();
    await vi.advanceTimersByTimeAsync(700);
    expect(clock.currentTimeMs).toBe(700);

    contexts[0].state = 'running';
    contexts[0].currentTime = 0.1;

    expect(clock.currentTimeMs).toBe(700);
    vi.useRealTimers();
  });
});
