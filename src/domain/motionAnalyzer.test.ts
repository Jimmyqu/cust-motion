import { describe, expect, it } from 'vitest';
import { MotionAnalyzer, calibratePose } from './motionAnalyzer';
import type { PoseFrame, PoseKeypointName } from './types';

function frame(timestampMs: number, overrides: Partial<Record<PoseKeypointName, { x: number; y: number; score?: number }>> = {}): PoseFrame {
  const base: Record<PoseKeypointName, { x: number; y: number; score: number }> = {
    left_shoulder: { x: 0.42, y: 0.34, score: 0.96 },
    right_shoulder: { x: 0.58, y: 0.34, score: 0.96 },
    left_hip: { x: 0.44, y: 0.62, score: 0.95 },
    right_hip: { x: 0.56, y: 0.62, score: 0.95 },
    left_wrist: { x: 0.35, y: 0.5, score: 0.94 },
    right_wrist: { x: 0.65, y: 0.5, score: 0.94 },
  };

  for (const [name, value] of Object.entries(overrides) as [PoseKeypointName, { x: number; y: number; score?: number }][]) {
    base[name] = { x: value.x, y: value.y, score: value.score ?? base[name].score };
  }

  return {
    timestampMs,
    keypoints: Object.entries(base).map(([name, value]) => ({ name: name as PoseKeypointName, ...value })),
  };
}

describe('calibratePose', () => {
  it('captures neutral center, shoulder width, and standing height', () => {
    const calibration = calibratePose(frame(0));

    expect(calibration.neutralCenter.x).toBeCloseTo(0.5);
    expect(calibration.neutralCenter.y).toBeCloseTo(0.48);
    expect(calibration.shoulderWidth).toBeCloseTo(0.16);
    expect(calibration.standingHeight).toBeCloseTo(0.28);
  });
});

describe('MotionAnalyzer', () => {
  it('calculates hand velocity and dominant swing direction', () => {
    const calibration = calibratePose(frame(0));
    const analyzer = new MotionAnalyzer(calibration, { smoothing: 0 });

    analyzer.analyze(frame(0));
    const motion = analyzer.analyze(frame(100, {
      right_wrist: { x: 0.65, y: 0.28 },
      left_wrist: { x: 0.2, y: 0.5 },
    }));

    expect(motion.rightHand.velocity.y).toBeLessThan(-1.9);
    expect(motion.rightHand.direction).toBe('up');
    expect(motion.leftHand.direction).toBe('left');
  });

  it('reports body lean relative to calibrated neutral center', () => {
    const calibration = calibratePose(frame(0));
    const analyzer = new MotionAnalyzer(calibration, { smoothing: 0 });

    const motion = analyzer.analyze(frame(100, {
      left_shoulder: { x: 0.5, y: 0.34 },
      right_shoulder: { x: 0.66, y: 0.34 },
      left_hip: { x: 0.52, y: 0.62 },
      right_hip: { x: 0.64, y: 0.62 },
    }));

    expect(motion.lean).toBeGreaterThan(0.5);
    expect(motion.trackingQuality).toBe('good');
  });

  it('detects crouching from lowered shoulders and hips', () => {
    const calibration = calibratePose(frame(0));
    const analyzer = new MotionAnalyzer(calibration, { smoothing: 0 });

    const motion = analyzer.analyze(frame(100, {
      left_shoulder: { x: 0.42, y: 0.48 },
      right_shoulder: { x: 0.58, y: 0.48 },
      left_hip: { x: 0.44, y: 0.74 },
      right_hip: { x: 0.56, y: 0.74 },
    }));

    expect(motion.crouchAmount).toBeGreaterThan(0.35);
    expect(motion.isCrouching).toBe(true);
  });

  it('downgrades tracking quality when required keypoints are uncertain', () => {
    const calibration = calibratePose(frame(0));
    const analyzer = new MotionAnalyzer(calibration);

    const motion = analyzer.analyze(frame(100, {
      left_wrist: { x: 0.35, y: 0.5, score: 0.12 },
      right_wrist: { x: 0.65, y: 0.5, score: 0.15 },
      left_shoulder: { x: 0.42, y: 0.34, score: 0.2 },
    }));

    expect(motion.trackingQuality).toBe('lost');
    expect(motion.leftHand.confidence).toBeLessThan(0.3);
  });

  it('holds the last reliable hand position during brief low-confidence wrist frames', () => {
    const calibration = calibratePose(frame(0));
    const analyzer = new MotionAnalyzer(calibration, { smoothing: 0, minConfidence: 0.45 });

    const reliable = analyzer.analyze(frame(0, {
      left_wrist: { x: 0.34, y: 0.5, score: 0.96 },
      right_wrist: { x: 0.66, y: 0.5, score: 0.96 },
    }));
    const unstable = analyzer.analyze(frame(100, {
      left_wrist: { x: 0.05, y: 0.1, score: 0.08 },
      right_wrist: { x: 0.95, y: 0.1, score: 0.08 },
    }));

    expect(unstable.trackingQuality).toBe('limited');
    expect(unstable.leftHand.position).toEqual(reliable.leftHand.position);
    expect(unstable.rightHand.position).toEqual(reliable.rightHand.position);
    expect(unstable.leftHand.speed).toBe(0);
    expect(unstable.rightHand.speed).toBe(0);
  });

  it('holds the last reliable body position during brief low-confidence torso frames', () => {
    const calibration = calibratePose(frame(0));
    const analyzer = new MotionAnalyzer(calibration, { smoothing: 0, minConfidence: 0.45 });

    const reliable = analyzer.analyze(frame(0));
    const unstable = analyzer.analyze(frame(100, {
      left_shoulder: { x: 0.08, y: 0.74, score: 0.1 },
      right_shoulder: { x: 0.24, y: 0.74, score: 0.1 },
      left_hip: { x: 0.1, y: 0.95, score: 0.1 },
      right_hip: { x: 0.22, y: 0.95, score: 0.1 },
    }));

    expect(unstable.trackingQuality).toBe('limited');
    expect(unstable.bodyCenter).toEqual(reliable.bodyCenter);
    expect(unstable.lean).toBeCloseTo(reliable.lean);
    expect(unstable.crouchAmount).toBeCloseTo(reliable.crouchAmount);
    expect(unstable.isCrouching).toBe(false);
  });

  it('reports tracking lost when torso and both hands are unavailable after interpolation', () => {
    const calibration = calibratePose(frame(0));
    const analyzer = new MotionAnalyzer(calibration, { smoothing: 0, minConfidence: 0.45 });

    analyzer.analyze(frame(0));
    const lost = analyzer.analyze(frame(100, {
      left_shoulder: { x: 0.08, y: 0.74, score: 0.1 },
      right_shoulder: { x: 0.24, y: 0.74, score: 0.1 },
      left_hip: { x: 0.1, y: 0.95, score: 0.1 },
      right_hip: { x: 0.22, y: 0.95, score: 0.1 },
      left_wrist: { x: 0.05, y: 0.1, score: 0.08 },
      right_wrist: { x: 0.95, y: 0.1, score: 0.08 },
    }));

    expect(lost.trackingQuality).toBe('lost');
  });
});
