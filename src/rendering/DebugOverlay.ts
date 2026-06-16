import type { MotionInput, PoseFrame, PoseKeypointName } from '../domain/types';
import { targetZoneByLane } from '../domain/playfield';

const bones: [PoseKeypointName, PoseKeypointName][] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_shoulder', 'left_wrist'],
  ['right_shoulder', 'right_wrist'],
];

export class DebugOverlay {
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private leftTrail: { x: number; y: number }[] = [];
  private rightTrail: { x: number; y: number }[] = [];

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'debug-canvas';
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Cannot create debug canvas context');
    }
    this.context = context;
    container.appendChild(this.canvas);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  setVisible(visible: boolean): void {
    this.canvas.hidden = !visible;
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.canvas.remove();
  }

  draw(video: HTMLVideoElement | undefined, pose: PoseFrame | undefined, motion: MotionInput | undefined, fps: number): void {
    const ctx = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 16, 0.68)';
    ctx.fillRect(0, 0, width, height);

    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.globalAlpha = 0.52;
      ctx.drawImage(video, 0, 0, width, height);
      ctx.restore();
    }

    if (pose) {
      this.drawCalibrationGuides();
      this.drawSkeleton(pose);
    }
    if (motion) {
      this.drawMotion(motion, fps);
    }
    ctx.restore();
  }

  private drawSkeleton(pose: PoseFrame): void {
    const points = new Map(pose.keypoints.map((point) => [point.name, point]));
    const ctx = this.context;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#78f5ff';
    ctx.fillStyle = '#ffffff';

    for (const [from, to] of bones) {
      const a = points.get(from);
      const b = points.get(to);
      if (!a || !b) {
        continue;
      }
      ctx.globalAlpha = Math.min(a.score, b.score);
      ctx.beginPath();
      ctx.moveTo(a.x * this.canvas.width, a.y * this.canvas.height);
      ctx.lineTo(b.x * this.canvas.width, b.y * this.canvas.height);
      ctx.stroke();
    }

    for (const point of pose.keypoints) {
      ctx.globalAlpha = point.score;
      ctx.beginPath();
      ctx.arc(point.x * this.canvas.width, point.y * this.canvas.height, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawCalibrationGuides(): void {
    const ctx = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const safeLeft = width * 0.36;
    const safeRight = width * 0.64;
    const leftHit = targetZoneByLane['center-left'];
    const rightHit = targetZoneByLane['center-right'];

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#55ffb0';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(safeLeft, height * 0.24, safeRight - safeLeft, height * 0.54);

    ctx.strokeStyle = '#f6cf5a';
    ctx.beginPath();
    ctx.moveTo(width * 0.5, 0);
    ctx.lineTo(width * 0.5, height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#29c9ff';
    ctx.strokeRect(width * leftHit.x - width * 0.08, height * leftHit.y - 50, width * 0.16, 100);
    ctx.strokeStyle = '#ff3868';
    ctx.strokeRect(width * rightHit.x - width * 0.08, height * rightHit.y - 50, width * 0.16, 100);

    ctx.fillStyle = '#dce9ff';
    ctx.font = '14px ui-sans-serif, system-ui';
    ctx.fillText('standing zone', safeLeft + 8, height * 0.24 + 22);
    ctx.fillText('left hit zone', width * leftHit.x - width * 0.08, height * leftHit.y - 58);
    ctx.fillText('right hit zone', width * rightHit.x - width * 0.08, height * rightHit.y - 58);
    ctx.restore();
  }

  private drawMotion(motion: MotionInput, fps: number): void {
    this.leftTrail = pushTrail(this.leftTrail, motion.leftHand.position);
    this.rightTrail = pushTrail(this.rightTrail, motion.rightHand.position);
    this.drawTrail(this.leftTrail, '#29c9ff');
    this.drawTrail(this.rightTrail, '#ff3868');

    const ctx = this.context;
    const cx = motion.bodyCenter.x * this.canvas.width;
    const cy = motion.bodyCenter.y * this.canvas.height;
    ctx.strokeStyle = '#f6cf5a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, this.canvas.height);
    ctx.stroke();
    ctx.fillStyle = '#f6cf5a';
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f6fbff';
    ctx.font = '16px ui-sans-serif, system-ui';
    ctx.fillText(`tracking: ${motion.trackingQuality}`, 24, 32);
    ctx.fillText(`fps: ${fps.toFixed(0)}`, 24, 56);
    ctx.fillText(`lean: ${motion.lean.toFixed(2)} crouch: ${motion.crouchAmount.toFixed(2)}`, 24, 80);
  }

  private drawTrail(points: { x: number; y: number }[], color: string): void {
    const ctx = this.context;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = point.x * this.canvas.width;
      const y = point.y * this.canvas.height;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }

  private resize = (): void => {
    const parent = this.canvas.parentElement;
    if (!parent) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    this.canvas.width = Math.max(1, Math.floor(parent.clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.floor(parent.clientHeight * dpr));
    this.canvas.style.width = `${parent.clientWidth}px`;
    this.canvas.style.height = `${parent.clientHeight}px`;
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
}

function pushTrail(trail: { x: number; y: number }[], point: { x: number; y: number }): { x: number; y: number }[] {
  return [...trail, point].slice(-18);
}
