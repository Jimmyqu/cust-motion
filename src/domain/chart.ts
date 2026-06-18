import type { Chart, ChartEvent, ObstacleEvent, TargetEvent } from './types';

const targetWindowMs = 180;

export const builtInChart: Chart = {
  bpm: 126,
  durationMs: 32_000,
  events: sortEvents([
    target('t-001', 1_200, 'left', 'center-left', 'up'),
    target('t-002', 1_680, 'right', 'center-right', 'up'),
    target('t-003', 2_160, 'left', 'left', 'left'),
    target('t-004', 2_640, 'right', 'right', 'right'),
    obstacle('o-001', 3_200, 'left-wall', 900),
    target('t-005', 4_000, 'left', 'center-left', 'down'),
    target('t-006', 4_240, 'right', 'center-right', 'down'),
    target('t-007', 5_000, 'left', 'left', 'up'),
    target('t-008', 5_480, 'right', 'right', 'up'),
    obstacle('o-002', 6_000, 'right-wall', 900),
    target('t-009', 7_000, 'left', 'center-left', 'right'),
    target('t-010', 7_000, 'right', 'center-right', 'left'),
    obstacle('o-003', 8_100, 'low-wall', 1_000),
    target('t-011', 9_400, 'left', 'left', 'up'),
    target('t-012', 9_880, 'right', 'right', 'down'),
    target('t-013', 10_360, 'left', 'center-left', 'left'),
    target('t-014', 10_840, 'right', 'center-right', 'right'),
    obstacle('o-004', 11_600, 'left-wall', 800),
    target('t-015', 12_400, 'left', 'center-left', 'up'),
    target('t-016', 12_640, 'right', 'center-right', 'up'),
    target('t-017', 13_360, 'left', 'left', 'down'),
    target('t-018', 13_840, 'right', 'right', 'down'),
    obstacle('o-005', 14_500, 'right-wall', 850),
    target('t-019', 15_200, 'left', 'center-left', 'right'),
    target('t-020', 15_440, 'right', 'center-right', 'left'),
    obstacle('o-006', 16_200, 'low-wall', 900),
    target('t-021', 17_200, 'left', 'left', 'up'),
    target('t-022', 17_680, 'right', 'right', 'up'),
    target('t-023', 18_160, 'left', 'center-left', 'down'),
    target('t-024', 18_640, 'right', 'center-right', 'down'),
  ]),
};

export function getUpcomingEvents(chart: Chart, timeMs: number, lookAheadMs: number): ChartEvent[] {
  const end = timeMs + lookAheadMs;
  return chart.events.filter((event) => {
    if (event.kind === 'obstacle') {
      return event.timeMs <= end && event.timeMs + event.durationMs >= timeMs;
    }

    return event.timeMs >= timeMs && event.timeMs <= end;
  });
}

export function getActiveTargets(chart: Chart, timeMs: number): TargetEvent[] {
  return chart.events.filter((event): event is TargetEvent => {
    return event.kind === 'target' && Math.abs(event.timeMs - timeMs) <= event.windowMs;
  });
}

export function getActiveObstacles(chart: Chart, timeMs: number): ObstacleEvent[] {
  return chart.events.filter((event): event is ObstacleEvent => {
    return event.kind === 'obstacle' && timeMs >= event.timeMs && timeMs <= event.timeMs + event.durationMs;
  });
}

export function isChartSorted(chart: Chart): boolean {
  return chart.events.every((event, index, events) => index === 0 || events[index - 1].timeMs <= event.timeMs);
}

export function sortEvents(events: ChartEvent[]): ChartEvent[] {
  return [...events].sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id));
}

function target(
  id: string,
  timeMs: number,
  hand: TargetEvent['hand'],
  lane: TargetEvent['lane'],
  direction: TargetEvent['direction'],
): TargetEvent {
  return { id, kind: 'target', timeMs, lane, hand, direction, windowMs: targetWindowMs };
}

function obstacle(id: string, timeMs: number, obstacleKind: ObstacleEvent['obstacle'], durationMs: number): ObstacleEvent {
  return { id, kind: 'obstacle', timeMs, obstacle: obstacleKind, durationMs };
}
