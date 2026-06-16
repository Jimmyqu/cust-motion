import * as THREE from 'three';
import type { ChartEvent, MotionInput, ObstacleEvent, TargetEvent } from '../domain/types';

interface RenderObject {
  id: string;
  mesh: THREE.Object3D;
}

const laneX: Record<TargetEvent['lane'], number> = {
  left: -2.4,
  'center-left': -1.05,
  'center-right': 1.05,
  right: 2.4,
};

export class GameRenderer {
  readonly canvas: HTMLCanvasElement;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.1, 120);
  private readonly clock = new THREE.Clock();
  private readonly targetObjects = new Map<string, RenderObject>();
  private readonly obstacleObjects = new Map<string, RenderObject>();
  private readonly saberGroup = new THREE.Group();
  private readonly particles: THREE.Points;
  private readonly tunnel = new THREE.Group();

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor('#03050c');
    this.camera.position.set(0, 1.4, 7.5);
    this.camera.lookAt(0, 0.5, -8);
    this.scene.fog = new THREE.Fog('#03050c', 12, 48);

    this.addLights();
    this.addTunnel();
    this.addSabers();
    this.particles = this.createParticles();
    this.scene.add(this.particles);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.canvas.remove();
  }

  render(timeMs: number, motion: MotionInput | undefined, events: ChartEvent[]): void {
    const delta = this.clock.getDelta();
    this.updateTunnel(delta);
    this.updateParticles(delta);
    this.updateSabers(motion);
    this.updateChartObjects(timeMs, events);
    this.renderer.render(this.scene, this.camera);
  }

  flashHit(hand: 'left' | 'right'): void {
    const color = hand === 'left' ? '#4cc9ff' : '#ff4f79';
    this.scene.background = new THREE.Color(color).multiplyScalar(0.08);
    window.setTimeout(() => {
      this.scene.background = null;
    }, 60);
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight('#5f7fff', 0.45));
    const key = new THREE.DirectionalLight('#ffffff', 1.2);
    key.position.set(2, 4, 4);
    this.scene.add(key);
    const cyan = new THREE.PointLight('#29e7ff', 3, 20);
    cyan.position.set(-3, 2, 2);
    this.scene.add(cyan);
    const pink = new THREE.PointLight('#ff3d75', 3, 20);
    pink.position.set(3, 2, 2);
    this.scene.add(pink);
  }

  private addTunnel(): void {
    const material = new THREE.LineBasicMaterial({ color: '#24466f', transparent: true, opacity: 0.65 });
    for (let i = 0; i < 28; i += 1) {
      const z = -i * 2.2;
      const points = [
        new THREE.Vector3(-3.2, -1.1, z),
        new THREE.Vector3(3.2, -1.1, z),
        new THREE.Vector3(3.2, 2.9, z),
        new THREE.Vector3(-3.2, 2.9, z),
        new THREE.Vector3(-3.2, -1.1, z),
      ];
      this.tunnel.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
    }

    const laneMaterial = new THREE.MeshBasicMaterial({ color: '#0b1b2f', transparent: true, opacity: 0.72 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 90), laneMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -1.12, -24);
    this.tunnel.add(floor);
    this.scene.add(this.tunnel);
  }

  private addSabers(): void {
    this.saberGroup.add(this.createSaber('left'));
    this.saberGroup.add(this.createSaber('right'));
    this.scene.add(this.saberGroup);
  }

  private createSaber(hand: 'left' | 'right'): THREE.Group {
    const group = new THREE.Group();
    group.name = `${hand}-saber`;
    const color = hand === 'left' ? '#29c9ff' : '#ff3868';
    const blade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.08, 1.5, 16),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8 }),
    );
    blade.rotation.z = Math.PI / 8;
    blade.position.y = 0.7;
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.28, 16),
      new THREE.MeshStandardMaterial({ color: '#dbe8ff', metalness: 0.6, roughness: 0.2 }),
    );
    group.add(blade, grip);
    group.position.set(hand === 'left' ? -1.3 : 1.3, -0.4, 2.2);
    return group;
  }

  private createParticles(): THREE.Points {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = Math.random() * 4 - 1;
      positions[i * 3 + 2] = -Math.random() * 56;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#79ecff', size: 0.025, transparent: true, opacity: 0.75 }));
  }

  private updateTunnel(delta: number): void {
    for (const child of this.tunnel.children) {
      if (child instanceof THREE.Line) {
        child.position.z += delta * 6;
        if (child.position.z > 2.2) {
          child.position.z -= 61.6;
        }
      }
    }
  }

  private updateParticles(delta: number): void {
    const positions = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i += 1) {
      const z = positions.getZ(i) + delta * 10;
      positions.setZ(i, z > 2 ? -56 : z);
    }
    positions.needsUpdate = true;
  }

  private updateSabers(motion: MotionInput | undefined): void {
    const left = this.saberGroup.getObjectByName('left-saber');
    const right = this.saberGroup.getObjectByName('right-saber');
    if (!left || !right || !motion) {
      return;
    }
    placeSaber(left, motion.leftHand.position, -1);
    placeSaber(right, motion.rightHand.position, 1);
  }

  private updateChartObjects(timeMs: number, events: ChartEvent[]): void {
    const visibleIds = new Set(events.map((event) => event.id));
    for (const event of events) {
      if (event.kind === 'target') {
        this.updateTarget(event, timeMs);
      } else {
        this.updateObstacle(event, timeMs);
      }
    }
    pruneObjects(this.targetObjects, visibleIds, this.scene);
    pruneObjects(this.obstacleObjects, visibleIds, this.scene);
  }

  private updateTarget(event: TargetEvent, timeMs: number): void {
    let object = this.targetObjects.get(event.id);
    if (!object) {
      const color = event.hand === 'left' ? '#29c9ff' : '#ff3868';
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.68, 0.28),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.75, roughness: 0.25 }),
      );
      this.scene.add(mesh);
      object = { id: event.id, mesh };
      this.targetObjects.set(event.id, object);
    }
    const travel = THREE.MathUtils.clamp((event.timeMs - timeMs) / 2_200, -0.1, 1);
    object.mesh.position.set(laneX[event.lane], 0.55, -24 * travel + 1.6);
    object.mesh.rotation.x += 0.025;
    object.mesh.rotation.y += event.hand === 'left' ? 0.035 : -0.035;
  }

  private updateObstacle(event: ObstacleEvent, timeMs: number): void {
    let object = this.obstacleObjects.get(event.id);
    if (!object) {
      const material = new THREE.MeshStandardMaterial({ color: '#f6cf5a', emissive: '#f6cf5a', emissiveIntensity: 0.65, transparent: true, opacity: 0.38 });
      const geometry = event.obstacle === 'low-wall' ? new THREE.BoxGeometry(6.3, 1.8, 0.28) : new THREE.BoxGeometry(2.8, 4, 0.28);
      const mesh = new THREE.Mesh(geometry, material);
      this.scene.add(mesh);
      object = { id: event.id, mesh };
      this.obstacleObjects.set(event.id, object);
    }
    const travel = THREE.MathUtils.clamp((event.timeMs - timeMs) / 2_200, -0.1, 1);
    const x = event.obstacle === 'left-wall' ? -1.8 : event.obstacle === 'right-wall' ? 1.8 : 0;
    const y = event.obstacle === 'low-wall' ? 0.9 : 0.75;
    object.mesh.position.set(x, y, -24 * travel + 1.5);
  }

  private resize = (): void => {
    const parent = this.canvas.parentElement;
    if (!parent) {
      return;
    }
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  };
}

function placeSaber(object: THREE.Object3D, point: { x: number; y: number }, fallbackSide: number): void {
  const x = (point.x - 0.5) * 5.8 || fallbackSide;
  const y = (0.72 - point.y) * 4;
  object.position.x = THREE.MathUtils.lerp(object.position.x, x, 0.35);
  object.position.y = THREE.MathUtils.lerp(object.position.y, y, 0.35);
  object.rotation.z = THREE.MathUtils.lerp(object.rotation.z, (point.x - 0.5) * -1.4, 0.25);
}

function pruneObjects(objects: Map<string, RenderObject>, visibleIds: Set<string>, scene: THREE.Scene): void {
  for (const [id, object] of objects.entries()) {
    if (!visibleIds.has(id)) {
      scene.remove(object.mesh);
      objects.delete(id);
    }
  }
}
