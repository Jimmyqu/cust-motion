export type ClockState = 'idle' | 'running' | 'paused' | 'ended';

export class AudioClock {
  private context?: AudioContext;
  private startedAt = 0;
  private pausedAtMs = 0;
  private timer?: number;
  state: ClockState = 'idle';

  constructor(private readonly durationMs: number) {}

  async start(): Promise<void> {
    this.stop();
    this.context = new AudioContext();
    this.startedAt = this.context.currentTime;
    this.pausedAtMs = 0;
    this.state = 'running';
    this.scheduleGeneratedSong(this.context, this.durationMs);
    this.timer = window.setTimeout(() => {
      this.state = 'ended';
    }, this.durationMs);
  }

  pause(): void {
    if (this.state !== 'running' || !this.context) {
      return;
    }
    this.pausedAtMs = this.currentTimeMs;
    void this.context.suspend();
    if (this.timer !== undefined) {
      window.clearTimeout(this.timer);
    }
    this.state = 'paused';
  }

  async resume(): Promise<void> {
    if (this.state !== 'paused' || !this.context) {
      return;
    }
    await this.context.resume();
    this.startedAt = this.context.currentTime - this.pausedAtMs / 1000;
    this.timer = window.setTimeout(() => {
      this.state = 'ended';
    }, Math.max(0, this.durationMs - this.pausedAtMs));
    this.state = 'running';
  }

  stop(): void {
    if (this.timer !== undefined) {
      window.clearTimeout(this.timer);
    }
    void this.context?.close();
    this.context = undefined;
    this.startedAt = 0;
    this.pausedAtMs = 0;
    this.state = 'idle';
  }

  get currentTimeMs(): number {
    if (!this.context) {
      return this.pausedAtMs;
    }
    if (this.state === 'paused') {
      return this.pausedAtMs;
    }
    return Math.min(this.durationMs, Math.max(0, (this.context.currentTime - this.startedAt) * 1000));
  }

  private scheduleGeneratedSong(context: AudioContext, durationMs: number): void {
    const master = context.createGain();
    master.gain.value = 0.08;
    master.connect(context.destination);

    const beatSeconds = 60 / 126;
    const totalBeats = Math.ceil(durationMs / 1000 / beatSeconds);
    for (let i = 0; i < totalBeats; i += 1) {
      const start = context.currentTime + i * beatSeconds;
      this.scheduleTone(context, master, start, i % 4 === 0 ? 220 : 330, 0.08);
      if (i % 2 === 1) {
        this.scheduleTone(context, master, start + beatSeconds * 0.5, 660, 0.04);
      }
    }
  }

  private scheduleTone(context: AudioContext, destination: AudioNode, start: number, frequency: number, duration: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.7, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}
