import type { TargetLane } from './types';

export const targetZoneByLane: Record<TargetLane, { x: number; y: number }> = {
  left: { x: 0.28, y: 0.52 },
  'center-left': { x: 0.42, y: 0.52 },
  'center-right': { x: 0.58, y: 0.52 },
  right: { x: 0.72, y: 0.52 },
};

export function isInsideTargetZone(lane: TargetLane, position: { x: number; y: number }, hitRadius: number): boolean {
  const zone = targetZoneByLane[lane];
  return Math.hypot(position.x - zone.x, position.y - zone.y) <= hitRadius;
}
