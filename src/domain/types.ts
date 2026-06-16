export type Handedness = 'left' | 'right';

export type SwingDirection = 'up' | 'down' | 'left' | 'right' | 'still';

export type TrackingQuality = 'good' | 'limited' | 'lost';

export interface Point2D {
  x: number;
  y: number;
}

export interface PoseKeypoint extends Point2D {
  name: PoseKeypointName;
  score: number;
}

export type PoseKeypointName =
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_hip'
  | 'right_hip'
  | 'left_wrist'
  | 'right_wrist';

export interface PoseFrame {
  timestampMs: number;
  keypoints: PoseKeypoint[];
}

export interface CalibrationProfile {
  neutralCenter: Point2D;
  shoulderWidth: number;
  standingHeight: number;
}

export interface HandMotion {
  position: Point2D;
  velocity: Point2D;
  speed: number;
  direction: SwingDirection;
  confidence: number;
}

export interface MotionInput {
  leftHand: HandMotion;
  rightHand: HandMotion;
  bodyCenter: Point2D;
  lean: number;
  crouchAmount: number;
  isCrouching: boolean;
  trackingQuality: TrackingQuality;
  timestampMs: number;
}

export type TargetLane = 'left' | 'center-left' | 'center-right' | 'right';

export type ObstacleKind = 'left-wall' | 'right-wall' | 'low-wall';

export interface TargetEvent {
  id: string;
  kind: 'target';
  timeMs: number;
  lane: TargetLane;
  hand: Handedness;
  direction: Exclude<SwingDirection, 'still'>;
  windowMs: number;
  hit?: boolean;
  missed?: boolean;
}

export interface ObstacleEvent {
  id: string;
  kind: 'obstacle';
  timeMs: number;
  durationMs: number;
  obstacle: ObstacleKind;
  hit?: boolean;
}

export type ChartEvent = TargetEvent | ObstacleEvent;

export interface Chart {
  bpm: number;
  durationMs: number;
  events: ChartEvent[];
}

export interface ScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  health: number;
  hits: number;
  misses: number;
  obstacleCollisions: number;
}

export type PlayStatus = 'ready' | 'playing' | 'tracking-lost' | 'finished';
