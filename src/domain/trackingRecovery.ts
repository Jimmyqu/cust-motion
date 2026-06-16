import type { MotionInput } from './types';

interface TrackingRecoveryOptions {
  requiredStableMs?: number;
}

export interface TrackingRecoveryState {
  canResume: boolean;
  progress: number;
  stableForMs: number;
}

export class TrackingRecoveryGate {
  private readonly requiredStableMs: number;
  private stableSinceMs?: number;

  constructor(options: TrackingRecoveryOptions = {}) {
    this.requiredStableMs = options.requiredStableMs ?? 800;
  }

  update(motion: MotionInput): TrackingRecoveryState {
    if (motion.trackingQuality !== 'good') {
      this.stableSinceMs = undefined;
      return { canResume: false, progress: 0, stableForMs: 0 };
    }

    this.stableSinceMs ??= motion.timestampMs;
    const stableForMs = Math.max(0, motion.timestampMs - this.stableSinceMs);
    const progress = Math.min(1, stableForMs / this.requiredStableMs);

    return {
      canResume: progress >= 1,
      progress,
      stableForMs,
    };
  }

  reset(): void {
    this.stableSinceMs = undefined;
  }
}
