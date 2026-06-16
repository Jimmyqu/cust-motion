import { describe, expect, it } from 'vitest';
import { RhythmGameEngine } from './gameEngine';
import type { Chart, MotionInput } from './types';

const targetChart: Chart = {
  bpm: 120,
  durationMs: 5_000,
  events: [
    { id: 'left-up', kind: 'target', timeMs: 1_000, windowMs: 150, hand: 'left', lane: 'center-left', direction: 'up' },
    { id: 'right-left', kind: 'target', timeMs: 1_500, windowMs: 150, hand: 'right', lane: 'center-right', direction: 'left' },
  ],
};

const lowWallChart: Chart = {
  bpm: 120,
  durationMs: 5_000,
  events: [
    { id: 'low-wall', kind: 'obstacle', timeMs: 2_000, durationMs: 500, obstacle: 'low-wall' },
  ],
};

const sideWallChart: Chart = {
  bpm: 120,
  durationMs: 5_000,
  events: [
    { id: 'left-wall', kind: 'obstacle', timeMs: 1_700, durationMs: 500, obstacle: 'left-wall' },
    { id: 'right-wall', kind: 'obstacle', timeMs: 1_800, durationMs: 500, obstacle: 'right-wall' },
  ],
};

function motion(overrides: Partial<MotionInput> = {}): MotionInput {
  return {
    timestampMs: 0,
    bodyCenter: { x: 0.5, y: 0.5 },
    lean: 0,
    crouchAmount: 0,
    isCrouching: false,
    trackingQuality: 'good',
    leftHand: {
      position: { x: 0.44, y: 0.52 },
      velocity: { x: 0, y: -2.5 },
      speed: 2.5,
      direction: 'up',
      confidence: 0.95,
    },
    rightHand: {
      position: { x: 0.56, y: 0.52 },
      velocity: { x: -2.2, y: 0 },
      speed: 2.2,
      direction: 'left',
      confidence: 0.95,
    },
    ...overrides,
  };
}

describe('RhythmGameEngine', () => {
  it('scores a matching-hand target hit with direction bonus', () => {
    const engine = new RhythmGameEngine(targetChart);

    const feedback = engine.update(1_000, motion());

    expect(feedback.hits.map((hit) => hit.eventId)).toContain('left-up');
    expect(engine.state.combo).toBe(1);
    expect(engine.state.score).toBeGreaterThan(100);
  });

  it('does not hit a target when the matching hand is too slow', () => {
    const engine = new RhythmGameEngine(targetChart);

    const feedback = engine.update(1_000, motion({
      leftHand: { ...motion().leftHand, speed: 0.1, direction: 'still' },
    }));

    expect(feedback.hits).toHaveLength(0);
    expect(engine.state.combo).toBe(0);
  });

  it('does not hit a target when the matching hand misses the target lane', () => {
    const engine = new RhythmGameEngine(targetChart);

    const feedback = engine.update(1_000, motion({
      leftHand: { ...motion().leftHand, position: { x: 0.88, y: 0.52 } },
    }));

    expect(feedback.hits).toHaveLength(0);
    expect(engine.state.combo).toBe(0);
  });

  it('marks past targets as missed and reduces health', () => {
    const engine = new RhythmGameEngine(targetChart);

    engine.update(1_400, motion({ leftHand: { ...motion().leftHand, speed: 0.1 } }));

    expect(engine.state.misses).toBe(1);
    expect(engine.state.health).toBeLessThan(100);
  });

  it('registers low-wall collisions unless the player is crouching', () => {
    const engine = new RhythmGameEngine(lowWallChart);

    const hit = engine.update(2_200, motion());
    expect(hit.obstacleCollisions.map((collision) => collision.eventId)).toContain('low-wall');
    expect(engine.state.obstacleCollisions).toBe(1);

    const crouchingEngine = new RhythmGameEngine(lowWallChart);
    const avoided = crouchingEngine.update(2_200, motion({ isCrouching: true, crouchAmount: 0.6 }));
    expect(avoided.obstacleCollisions).toHaveLength(0);
  });

  it('lets the player avoid side walls by leaning away from the blocked side', () => {
    const leftWallCollisionEngine = new RhythmGameEngine(sideWallChart);
    expect(leftWallCollisionEngine.update(1_800, motion()).obstacleCollisions.map((collision) => collision.eventId)).toContain('left-wall');

    const leftWallAvoidedEngine = new RhythmGameEngine(sideWallChart);
    expect(leftWallAvoidedEngine.update(1_800, motion({ lean: 0.7 })).obstacleCollisions.map((collision) => collision.eventId)).not.toContain('left-wall');

    const rightWallCollisionEngine = new RhythmGameEngine(sideWallChart);
    expect(rightWallCollisionEngine.update(1_900, motion()).obstacleCollisions.map((collision) => collision.eventId)).toContain('right-wall');

    const rightWallAvoidedEngine = new RhythmGameEngine(sideWallChart);
    expect(rightWallAvoidedEngine.update(1_900, motion({ lean: -0.7 })).obstacleCollisions.map((collision) => collision.eventId)).not.toContain('right-wall');
  });

  it('soft pauses when tracking is lost for too long', () => {
    const engine = new RhythmGameEngine(targetChart, { trackingLossGraceMs: 300 });

    engine.update(100, motion({ trackingQuality: 'lost' }));
    engine.update(500, motion({ trackingQuality: 'lost' }));

    expect(engine.status).toBe('tracking-lost');
  });
});
