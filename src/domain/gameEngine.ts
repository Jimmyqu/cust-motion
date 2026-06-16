import type { Chart, MotionInput, ObstacleEvent, PlayStatus, ScoreState, TargetEvent } from './types';
import { isInsideTargetZone } from './playfield';

interface EngineOptions {
  minSwingSpeed?: number;
  trackingLossGraceMs?: number;
  hitRadius?: number;
}

interface HitFeedback {
  eventId: string;
  rating: 'good' | 'perfect';
  directionBonus: boolean;
}

interface ObstacleFeedback {
  eventId: string;
  obstacle: ObstacleEvent['obstacle'];
}

export interface EngineFeedback {
  hits: HitFeedback[];
  misses: string[];
  obstacleCollisions: ObstacleFeedback[];
  status: PlayStatus;
}

export class RhythmGameEngine {
  readonly state: ScoreState = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    health: 100,
    hits: 0,
    misses: 0,
    obstacleCollisions: 0,
  };

  status: PlayStatus = 'ready';

  private readonly handledTargets = new Set<string>();
  private readonly collidedObstacles = new Set<string>();
  private readonly minSwingSpeed: number;
  private readonly trackingLossGraceMs: number;
  private readonly hitRadius: number;
  private trackingLostSince?: number;

  constructor(
    private readonly chart: Chart,
    options: EngineOptions = {},
  ) {
    this.minSwingSpeed = options.minSwingSpeed ?? 0.8;
    this.trackingLossGraceMs = options.trackingLossGraceMs ?? 700;
    this.hitRadius = options.hitRadius ?? 0.16;
  }

  update(timeMs: number, motion: MotionInput): EngineFeedback {
    if (this.status === 'ready') {
      this.status = 'playing';
    }

    this.updateTrackingStatus(timeMs, motion);

    const feedback: EngineFeedback = {
      hits: [],
      misses: [],
      obstacleCollisions: [],
      status: this.status,
    };

    if (this.status === 'tracking-lost') {
      feedback.status = this.status;
      return feedback;
    }

    for (const target of this.chart.events.filter((event): event is TargetEvent => event.kind === 'target')) {
      if (this.handledTargets.has(target.id)) {
        continue;
      }

      const delta = Math.abs(timeMs - target.timeMs);
      if (delta <= target.windowMs) {
        const hit = this.tryHitTarget(target, motion, delta);
        if (hit) {
          feedback.hits.push(hit);
        }
      } else if (timeMs > target.timeMs + target.windowMs) {
        this.registerMiss(target.id);
        feedback.misses.push(target.id);
      }
    }

    for (const obstacle of this.chart.events.filter((event): event is ObstacleEvent => event.kind === 'obstacle')) {
      if (this.collidedObstacles.has(obstacle.id)) {
        continue;
      }
      if (timeMs >= obstacle.timeMs && timeMs <= obstacle.timeMs + obstacle.durationMs && this.collidesWithObstacle(obstacle, motion)) {
        this.collidedObstacles.add(obstacle.id);
        this.state.obstacleCollisions += 1;
        this.state.combo = 0;
        this.state.health = Math.max(0, this.state.health - 12);
        feedback.obstacleCollisions.push({ eventId: obstacle.id, obstacle: obstacle.obstacle });
      }
    }

    if (timeMs >= this.chart.durationMs || this.state.health <= 0) {
      this.status = 'finished';
    }

    feedback.status = this.status;
    return feedback;
  }

  private tryHitTarget(target: TargetEvent, motion: MotionInput, timingDeltaMs: number): HitFeedback | undefined {
    const hand = target.hand === 'left' ? motion.leftHand : motion.rightHand;
    if (hand.speed < this.minSwingSpeed || hand.confidence < 0.35) {
      return undefined;
    }
    if (!isInsideTargetZone(target.lane, hand.position, this.hitRadius)) {
      return undefined;
    }

    const directionBonus = hand.direction === target.direction;
    const rating = timingDeltaMs <= target.windowMs * 0.35 ? 'perfect' : 'good';
    const baseScore = rating === 'perfect' ? 140 : 100;
    this.handledTargets.add(target.id);
    this.state.hits += 1;
    this.state.combo += 1;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    this.state.score += baseScore + this.state.combo * 4 + (directionBonus ? 35 : 0);

    return { eventId: target.id, rating, directionBonus };
  }

  private registerMiss(targetId: string): void {
    this.handledTargets.add(targetId);
    this.state.misses += 1;
    this.state.combo = 0;
    this.state.health = Math.max(0, this.state.health - 8);
  }

  private collidesWithObstacle(obstacle: ObstacleEvent, motion: MotionInput): boolean {
    switch (obstacle.obstacle) {
      case 'left-wall':
        return motion.lean < 0.55;
      case 'right-wall':
        return motion.lean > -0.55;
      case 'low-wall':
        return !motion.isCrouching || motion.crouchAmount < 0.35;
    }
  }

  private updateTrackingStatus(timeMs: number, motion: MotionInput): void {
    if (motion.trackingQuality === 'lost') {
      this.trackingLostSince ??= timeMs;
      if (timeMs - this.trackingLostSince >= this.trackingLossGraceMs) {
        this.status = 'tracking-lost';
      }
      return;
    }

    this.trackingLostSince = undefined;
    if (this.status === 'tracking-lost') {
      this.status = 'playing';
    }
  }
}
