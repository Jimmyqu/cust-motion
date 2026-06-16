import type { MotionInput } from './types';

interface CalibrationReadinessOptions {
  requiredStableMs?: number;
}

export interface CalibrationReadinessState {
  ready: boolean;
  progress: number;
  stableForMs: number;
}

export class CalibrationReadiness {
  private readonly requiredStableMs: number;
  private stableSinceMs?: number;

  constructor(options: CalibrationReadinessOptions = {}) {
    this.requiredStableMs = options.requiredStableMs ?? 1_200;
  }

  update(motion: MotionInput): CalibrationReadinessState {
    if (motion.trackingQuality !== 'good') {
      this.stableSinceMs = undefined;
      return { ready: false, progress: 0, stableForMs: 0 };
    }

    this.stableSinceMs ??= motion.timestampMs;
    const stableForMs = Math.max(0, motion.timestampMs - this.stableSinceMs);
    const progress = Math.min(1, stableForMs / this.requiredStableMs);

    return {
      ready: progress >= 1,
      progress,
      stableForMs,
    };
  }

  reset(): void {
    this.stableSinceMs = undefined;
  }
}
