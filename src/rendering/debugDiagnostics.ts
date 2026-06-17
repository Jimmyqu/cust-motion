import type { MotionInput, PoseFrame, PoseKeypointName } from '../domain/types';

const diagnosticPairs: [label: string, left: PoseKeypointName, right: PoseKeypointName][] = [
  ['wrists', 'left_wrist', 'right_wrist'],
  ['shoulders', 'left_shoulder', 'right_shoulder'],
  ['hips', 'left_hip', 'right_hip'],
];

export function formatDebugDiagnostics(pose: PoseFrame | undefined, motion: MotionInput, fps: number): string[] {
  return [
    `tracking: ${motion.trackingQuality}`,
    `fps: ${fps.toFixed(0)}`,
    `lean: ${motion.lean.toFixed(2)} crouch: ${motion.crouchAmount.toFixed(2)}`,
    ...formatConfidenceLines(pose),
  ];
}

function formatConfidenceLines(pose: PoseFrame | undefined): string[] {
  if (!pose) {
    return ['wrists: L -- R --', 'shoulders: L -- R --', 'hips: L -- R --'];
  }

  const points = new Map(pose.keypoints.map((point) => [point.name, point.score]));
  return diagnosticPairs.map(([label, left, right]) => `${label}: L ${percent(points.get(left))} R ${percent(points.get(right))}`);
}

function percent(score: number | undefined): string {
  return score === undefined ? '--' : `${Math.round(score * 100)}%`;
}
