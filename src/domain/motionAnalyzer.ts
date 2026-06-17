import type {
  CalibrationProfile,
  HandMotion,
  MotionInput,
  Point2D,
  PoseFrame,
  PoseKeypoint,
  PoseKeypointName,
  SwingDirection,
  TrackingQuality,
} from './types';

interface AnalyzerOptions {
  smoothing?: number;
  minConfidence?: number;
  crouchThreshold?: number;
}

const REQUIRED_POINTS: PoseKeypointName[] = [
  'left_shoulder',
  'right_shoulder',
  'left_hip',
  'right_hip',
  'left_wrist',
  'right_wrist',
];

export function calibratePose(frame: PoseFrame): CalibrationProfile {
  const points = pointMap(frame);
  const leftShoulder = requirePoint(points, 'left_shoulder');
  const rightShoulder = requirePoint(points, 'right_shoulder');
  const leftHip = requirePoint(points, 'left_hip');
  const rightHip = requirePoint(points, 'right_hip');

  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const neutralCenter = midpoint(shoulderCenter, hipCenter);
  const shoulderWidth = Math.max(distance(leftShoulder, rightShoulder), 0.01);
  const standingHeight = Math.max(Math.abs(hipCenter.y - shoulderCenter.y), 0.01);

  return { neutralCenter, shoulderWidth, standingHeight };
}

export class MotionAnalyzer {
  private previous?: MotionInput;
  private readonly smoothing: number;
  private readonly minConfidence: number;
  private readonly crouchThreshold: number;

  constructor(
    private readonly calibration: CalibrationProfile,
    options: AnalyzerOptions = {},
  ) {
    this.smoothing = clamp(options.smoothing ?? 0.35, 0, 0.95);
    this.minConfidence = options.minConfidence ?? 0.45;
    this.crouchThreshold = options.crouchThreshold ?? 0.3;
  }

  analyze(frame: PoseFrame): MotionInput {
    const points = pointMap(frame);
    const leftShoulder = requirePoint(points, 'left_shoulder');
    const rightShoulder = requirePoint(points, 'right_shoulder');
    const leftHip = requirePoint(points, 'left_hip');
    const rightHip = requirePoint(points, 'right_hip');
    const leftWrist = requirePoint(points, 'left_wrist');
    const rightWrist = requirePoint(points, 'right_wrist');

    const torsoPoints = [leftShoulder, rightShoulder, leftHip, rightHip];
    const hasReliableTorso = torsoPoints.every((point) => point.score >= this.minConfidence);
    const shoulderCenter = midpoint(leftShoulder, rightShoulder);
    const hipCenter = midpoint(leftHip, rightHip);
    const rawCenter = hasReliableTorso || !this.previous
      ? midpoint(shoulderCenter, hipCenter)
      : this.previous.bodyCenter;
    const bodyCenter = this.previous ? smoothPoint(this.previous.bodyCenter, rawCenter, this.smoothing) : rawCenter;
    const dtSeconds = this.previous
      ? Math.max((frame.timestampMs - this.previous.timestampMs) / 1000, 1 / 120)
      : 1 / 60;

    const leftHand = this.handMotion(leftWrist, this.previous?.leftHand, dtSeconds);
    const rightHand = this.handMotion(rightWrist, this.previous?.rightHand, dtSeconds);
    const lean = (bodyCenter.x - this.calibration.neutralCenter.x) / this.calibration.shoulderWidth;
    const crouchAmount = Math.max(0, (bodyCenter.y - this.calibration.neutralCenter.y) / this.calibration.standingHeight);
    const usedInterpolatedTorso = this.previous !== undefined && !hasReliableTorso;
    const bothHandsUnavailable = leftWrist.score < this.minConfidence && rightWrist.score < this.minConfidence;
    const trackingQuality = capInterpolatedQuality(
      classifyTrackingQuality(this.stabilizedScores(points, hasReliableTorso), this.minConfidence),
      usedInterpolatedTorso,
      bothHandsUnavailable,
    );

    const motion: MotionInput = {
      leftHand,
      rightHand,
      bodyCenter,
      lean,
      crouchAmount,
      isCrouching: crouchAmount >= this.crouchThreshold,
      trackingQuality,
      timestampMs: frame.timestampMs,
    };

    this.previous = motion;
    return motion;
  }

  private handMotion(point: PoseKeypoint, previous: HandMotion | undefined, dtSeconds: number): HandMotion {
    const rawPosition = point.score >= this.minConfidence || !previous
      ? { x: point.x, y: point.y }
      : previous.position;
    const position = previous ? smoothPoint(previous.position, rawPosition, this.smoothing) : rawPosition;
    const velocity = previous
      ? {
          x: (position.x - previous.position.x) / dtSeconds,
          y: (position.y - previous.position.y) / dtSeconds,
        }
      : { x: 0, y: 0 };
    const speed = Math.hypot(velocity.x, velocity.y);

    return {
      position,
      velocity,
      speed,
      direction: directionFromVelocity(velocity, speed),
      confidence: point.score,
    };
  }

  private stabilizedScores(points: Map<PoseKeypointName, PoseKeypoint>, hasReliableTorso: boolean): number[] {
    return REQUIRED_POINTS.map((name) => {
      const point = requirePoint(points, name);
      const isTorsoPoint = name === 'left_shoulder' || name === 'right_shoulder' || name === 'left_hip' || name === 'right_hip';

      if (this.previous && isTorsoPoint && !hasReliableTorso) {
        return Math.max(point.score, this.minConfidence);
      }

      return point.score;
    });
  }
}

function pointMap(frame: PoseFrame): Map<PoseKeypointName, PoseKeypoint> {
  return new Map(frame.keypoints.map((point) => [point.name, point]));
}

function requirePoint(points: Map<PoseKeypointName, PoseKeypoint>, name: PoseKeypointName): PoseKeypoint {
  const point = points.get(name);
  if (!point) {
    throw new Error(`Missing pose keypoint: ${name}`);
  }
  return point;
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function smoothPoint(previous: Point2D, next: Point2D, smoothing: number): Point2D {
  return {
    x: previous.x * smoothing + next.x * (1 - smoothing),
    y: previous.y * smoothing + next.y * (1 - smoothing),
  };
}

function directionFromVelocity(velocity: Point2D, speed: number): SwingDirection {
  if (speed < 0.25) {
    return 'still';
  }
  if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
    return velocity.x > 0 ? 'right' : 'left';
  }
  return velocity.y > 0 ? 'down' : 'up';
}

function classifyTrackingQuality(scores: number[], minConfidence: number): TrackingQuality {
  const confident = scores.filter((score) => score >= minConfidence).length;
  if (confident === scores.length) {
    return 'good';
  }
  if (confident >= scores.length - 2) {
    return 'limited';
  }
  return 'lost';
}

function capInterpolatedQuality(quality: TrackingQuality, usedInterpolatedTorso: boolean, bothHandsUnavailable: boolean): TrackingQuality {
  if (usedInterpolatedTorso && bothHandsUnavailable) {
    return 'lost';
  }
  return usedInterpolatedTorso && quality === 'good' ? 'limited' : quality;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
