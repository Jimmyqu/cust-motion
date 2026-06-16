import { describe, expect, it } from 'vitest';
import { TrackingRecoveryGate } from './trackingRecovery';
import type { MotionInput } from './types';

function motion(timestampMs: number, trackingQuality: MotionInput['trackingQuality'] = 'good'): MotionInput {
  return {
    timestampMs,
    bodyCenter: { x: 0.5, y: 0.5 },
    lean: 0,
    crouchAmount: 0,
    isCrouching: false,
    trackingQuality,
    leftHand: {
      position: { x: 0.42, y: 0.52 },
      velocity: { x: 0, y: 0 },
      speed: 0,
      direction: 'still',
      confidence: 0.9,
    },
    rightHand: {
      position: { x: 0.58, y: 0.52 },
      velocity: { x: 0, y: 0 },
      speed: 0,
      direction: 'still',
      confidence: 0.9,
    },
  };
}

describe('TrackingRecoveryGate', () => {
  it('requires stable good tracking before resume is allowed', () => {
    const gate = new TrackingRecoveryGate({ requiredStableMs: 600 });

    expect(gate.update(motion(100)).canResume).toBe(false);
    expect(gate.update(motion(500)).canResume).toBe(false);
    expect(gate.update(motion(700)).canResume).toBe(true);
  });

  it('resets recovery progress if tracking drops again', () => {
    const gate = new TrackingRecoveryGate({ requiredStableMs: 600 });

    gate.update(motion(100));
    gate.update(motion(500));
    const lost = gate.update(motion(520, 'lost'));
    const recovered = gate.update(motion(900));

    expect(lost).toEqual({ canResume: false, progress: 0, stableForMs: 0 });
    expect(recovered.canResume).toBe(false);
    expect(recovered.progress).toBe(0);
  });
});
