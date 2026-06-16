export type RenderQualityMode = 'high' | 'low';

export interface RenderQualitySettings {
  pixelRatio: number;
  particleCount: number;
}

export function resolveRenderQuality(mode: RenderQualityMode, devicePixelRatio: number): RenderQualitySettings {
  if (mode === 'low') {
    return {
      pixelRatio: Math.min(devicePixelRatio, 0.85),
      particleCount: 180,
    };
  }

  return {
    pixelRatio: Math.min(devicePixelRatio, 1.5),
    particleCount: 500,
  };
}
