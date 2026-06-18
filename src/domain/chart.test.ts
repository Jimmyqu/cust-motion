import { describe, expect, it } from 'vitest';
import { builtInChart, getActiveObstacles, getActiveTargets, getUpcomingEvents, isChartSorted } from './chart';

describe('builtInChart', () => {
  it('keeps events sorted by hit time', () => {
    expect(isChartSorted(builtInChart)).toBe(true);
    expect(builtInChart.events.length).toBeGreaterThan(12);
  });

  it('contains all first-version obstacle types', () => {
    const obstacleKinds = new Set(builtInChart.events.filter((event) => event.kind === 'obstacle').map((event) => event.obstacle));

    expect(obstacleKinds).toEqual(new Set(['left-wall', 'right-wall', 'low-wall']));
  });
});

describe('chart queries', () => {
  it('returns targets inside their timing window', () => {
    const target = builtInChart.events.find((event) => event.kind === 'target');
    if (!target || target.kind !== 'target') {
      throw new Error('expected built-in target');
    }

    expect(getActiveTargets(builtInChart, target.timeMs).map((event) => event.id)).toContain(target.id);
    expect(getActiveTargets(builtInChart, target.timeMs + target.windowMs + 1).map((event) => event.id)).not.toContain(target.id);
  });

  it('returns obstacles while their duration overlaps the current time', () => {
    const obstacle = builtInChart.events.find((event) => event.kind === 'obstacle');
    if (!obstacle || obstacle.kind !== 'obstacle') {
      throw new Error('expected built-in obstacle');
    }

    expect(getActiveObstacles(builtInChart, obstacle.timeMs + obstacle.durationMs / 2).map((event) => event.id)).toContain(obstacle.id);
    expect(getActiveObstacles(builtInChart, obstacle.timeMs + obstacle.durationMs + 1).map((event) => event.id)).not.toContain(obstacle.id);
  });

  it('returns upcoming events before they reach the hit zone', () => {
    const events = getUpcomingEvents(builtInChart, 0, 2_000);

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.timeMs >= 0 && event.timeMs <= 2_000)).toBe(true);
  });

  it('keeps already-started obstacles visible until their wall duration ends', () => {
    const chart = {
      bpm: 120,
      durationMs: 5_000,
      events: [
        { id: 'early-wall', kind: 'obstacle' as const, timeMs: 1_000, durationMs: 1_500, obstacle: 'left-wall' as const },
        { id: 'expired-wall', kind: 'obstacle' as const, timeMs: 200, durationMs: 500, obstacle: 'right-wall' as const },
      ],
    };

    const events = getUpcomingEvents(chart, 1_800, 1_000);

    expect(events.map((event) => event.id)).toContain('early-wall');
    expect(events.map((event) => event.id)).not.toContain('expired-wall');
  });
});
