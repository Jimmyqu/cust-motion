import { describe, expect, it } from 'vitest';
import { isInsideTargetZone, targetZoneByLane } from './playfield';

describe('playfield target zones', () => {
  it('matches positions near each target lane', () => {
    expect(isInsideTargetZone('center-left', targetZoneByLane['center-left'], 0.16)).toBe(true);
    expect(isInsideTargetZone('center-right', targetZoneByLane['center-right'], 0.16)).toBe(true);
  });

  it('rejects positions far from the target lane', () => {
    expect(isInsideTargetZone('center-left', { x: 0.88, y: 0.52 }, 0.16)).toBe(false);
  });
});
