import type { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { PoseFrame, PoseKeypoint, PoseKeypointName } from '../domain/types';

type TasksVisionModule = typeof import('@mediapipe/tasks-vision');

export type PoseSourceMode = 'camera' | 'simulated';

export interface PoseSourceState {
  mode: PoseSourceMode;
  video?: HTMLVideoElement;
  error?: string;
}

export interface PoseSource {
  state: PoseSourceState;
  start(onFrame: (frame: PoseFrame) => void): Promise<void>;
  stop(): void;
}

const keypointIndexes: Record<PoseKeypointName, number> = {
  left_shoulder: 11,
  right_shoulder: 12,
  left_hip: 23,
  right_hip: 24,
  left_wrist: 15,
  right_wrist: 16,
};

export class CameraPoseSource implements PoseSource {
  state: PoseSourceState = { mode: 'camera' };

  private video?: HTMLVideoElement;
  private stream?: MediaStream;
  private landmarker?: PoseLandmarker;
  private rafId?: number;
  private lastInference = 0;

  constructor(private readonly inferenceIntervalMs = 40) {}

  async start(onFrame: (frame: PoseFrame) => void): Promise<void> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support camera capture.');
      }

      this.video = document.createElement('video');
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.autoplay = true;
      this.video.style.display = 'none';

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      this.video.srcObject = this.stream;
      document.body.appendChild(this.video);
      await this.video.play();

      this.landmarker = await createPoseLandmarker();
      this.state = { mode: 'camera', video: this.video };

      const tick = (now: number) => {
        if (!this.video || !this.landmarker) {
          return;
        }
        if (now - this.lastInference >= this.inferenceIntervalMs && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          this.lastInference = now;
          const result = this.landmarker.detectForVideo(this.video, now);
          const frame = poseResultToFrame(result, now);
          if (frame) {
            onFrame(frame);
          }
        }
        this.rafId = requestAnimationFrame(tick);
      };

      this.rafId = requestAnimationFrame(tick);
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.landmarker?.close();
    this.video?.remove();
    this.stream = undefined;
    this.landmarker = undefined;
    this.video = undefined;
    this.state = { mode: 'camera' };
  }
}

export class SimulatedPoseSource implements PoseSource {
  state: PoseSourceState = { mode: 'simulated' };
  private rafId?: number;

  async start(onFrame: (frame: PoseFrame) => void): Promise<void> {
    const tick = (now: number) => {
      onFrame(simulatedPose(now));
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
    }
  }
}

export async function createBestPoseSource(): Promise<PoseSource> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return new SimulatedPoseSource();
  }
  return new CameraPoseSource();
}

function poseResultToFrame(result: PoseLandmarkerResult, timestampMs: number): PoseFrame | undefined {
  const landmarks = result.landmarks[0];
  if (!landmarks) {
    return undefined;
  }

  const keypoints = Object.entries(keypointIndexes).map(([name, index]) => {
    const landmark = landmarks[index];
    return {
      name: name as PoseKeypointName,
      x: 1 - landmark.x,
      y: landmark.y,
      score: landmark.visibility ?? 0.8,
    } satisfies PoseKeypoint;
  });

  return { timestampMs, keypoints };
}

async function createPoseLandmarker(): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
  try {
    return await createPoseLandmarkerWithDelegate(PoseLandmarker, vision, 'GPU');
  } catch {
    return createPoseLandmarkerWithDelegate(PoseLandmarker, vision, 'CPU');
  }
}

function createPoseLandmarkerWithDelegate(
  poseLandmarker: TasksVisionModule['PoseLandmarker'],
  vision: Parameters<TasksVisionModule['PoseLandmarker']['createFromOptions']>[0],
  delegate: 'GPU' | 'CPU',
): Promise<PoseLandmarker> {
  return poseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
      delegate,
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.45,
    minPosePresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
  });
}

function simulatedPose(timestampMs: number): PoseFrame {
  const t = timestampMs / 1000;
  const wave = Math.sin(t * 3);
  const side = Math.sin(t * 0.8) * 0.08;
  const crouch = Math.max(0, Math.sin(t * 0.45 - 1.2)) * 0.12;
  const leftWristY = 0.5 - Math.max(0, wave) * 0.22;
  const rightWristY = 0.5 - Math.max(0, -wave) * 0.22;

  return {
    timestampMs,
    keypoints: [
      point('left_shoulder', 0.42 + side, 0.34 + crouch),
      point('right_shoulder', 0.58 + side, 0.34 + crouch),
      point('left_hip', 0.44 + side, 0.62 + crouch),
      point('right_hip', 0.56 + side, 0.62 + crouch),
      point('left_wrist', 0.34 + side - Math.max(0, -wave) * 0.08, leftWristY + crouch),
      point('right_wrist', 0.66 + side + Math.max(0, wave) * 0.08, rightWristY + crouch),
    ],
  };
}

function point(name: PoseKeypointName, x: number, y: number): PoseKeypoint {
  return { name, x, y, score: 0.96 };
}
