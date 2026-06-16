import { describe, expect, it } from 'vitest';
import { CalibrationReadiness } from './calibrationReadiness';
import type { MotionInput } from './types';

function motion(timestampMs: number, trackingQuality: MotionInput['trackingQuality'] = 'good'): MotionInput {
  return {
    timestampMs,
    bodyCenter: { x: 0.5, y: 0.48 },
    lean: 0,
    crouchAmount: 0,
    isCrouching: false,
    trackingQuality,
    leftHand: {
      position: { x: 0.35, y: 0.5 },
      velocity: { x: 0, y: 0 },
      speed: 0,
      direction: 'still',
      confidence: 0.92,
    },
    rightHand: {
      position: { x: 0.65, y: 0.5 },
      velocity: { x: 0, y: 0 },
      speed: 0,
      direction: 'still',
      confidence: 0.93,
    },
  };
}

describe('CalibrationReadiness', () => {
  it('does not become ready from a single confident pose frame', () => {
    const readiness = new CalibrationReadiness({ requiredStableMs: 900 });

    const result = readiness.update(motion(100));

    expect(result.ready).toBe(false);
    expect(result.progress).toBe(0);
  });

  it('becomes ready after confident tracking stays stable long enough', () => {
    const readiness = new CalibrationReadiness({ requiredStableMs: 900 });

    readiness.update(motion(100));
    readiness.update(motion(550));
    const result = readiness.update(motion(1_000));

    expect(result.ready).toBe(true);
    expect(result.progress).toBe(1);
  });

  it('resets progress when tracking quality is lost', () => {
    const readiness = new CalibrationReadiness({ requiredStableMs: 900 });

    readiness.update(motion(100));
    readiness.update(motion(700));
    const lost = readiness.update(motion(750, 'lost'));
    const recovered = readiness.update(motion(1_000));

    expect(lost.ready).toBe(false);
    expect(lost.progress).toBe(0);
    expect(recovered.ready).toBe(false);
    expect(recovered.progress).toBe(0);
  });
});
