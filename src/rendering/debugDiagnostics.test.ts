import { describe, expect, it } from 'vitest';
import { formatDebugDiagnostics } from './debugDiagnostics';
import type { MotionInput, PoseFrame } from '../domain/types';

const pose: PoseFrame = {
  timestampMs: 1_000,
  keypoints: [
    { name: 'left_shoulder', x: 0.42, y: 0.34, score: 0.91 },
    { name: 'right_shoulder', x: 0.58, y: 0.34, score: 0.87 },
    { name: 'left_hip', x: 0.44, y: 0.62, score: 0.78 },
    { name: 'right_hip', x: 0.56, y: 0.62, score: 0.82 },
    { name: 'left_wrist', x: 0.34, y: 0.5, score: 0.66 },
    { name: 'right_wrist', x: 0.66, y: 0.5, score: 0.71 },
  ],
};

const motion: MotionInput = {
  timestampMs: 1_000,
  bodyCenter: { x: 0.5, y: 0.48 },
  lean: 0.24,
  crouchAmount: 0.12,
  isCrouching: false,
  trackingQuality: 'limited',
  leftHand: {
    position: { x: 0.34, y: 0.5 },
    velocity: { x: 0, y: -1.2 },
    speed: 1.2,
    direction: 'up',
    confidence: 0.66,
  },
  rightHand: {
    position: { x: 0.66, y: 0.5 },
    velocity: { x: 1, y: 0 },
    speed: 1,
    direction: 'right',
    confidence: 0.71,
  },
};

describe('formatDebugDiagnostics', () => {
  it('formats tracking, motion, and keypoint confidence values for calibration overlay', () => {
    const lines = formatDebugDiagnostics(pose, motion, 59.6);

    expect(lines).toContain('tracking: limited');
    expect(lines).toContain('fps: 60');
    expect(lines).toContain('lean: 0.24 crouch: 0.12');
    expect(lines).toContain('wrists: L 66% R 71%');
    expect(lines).toContain('shoulders: L 91% R 87%');
    expect(lines).toContain('hips: L 78% R 82%');
  });
});
