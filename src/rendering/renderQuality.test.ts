import { describe, expect, it } from 'vitest';
import { resolveRenderQuality } from './renderQuality';

describe('resolveRenderQuality', () => {
  it('uses fuller effects for high quality', () => {
    const quality = resolveRenderQuality('high', 3);

    expect(quality.pixelRatio).toBe(1.5);
    expect(quality.particleCount).toBe(500);
  });

  it('reduces pixel ratio and particles for low quality', () => {
    const quality = resolveRenderQuality('low', 3);

    expect(quality.pixelRatio).toBeLessThan(1);
    expect(quality.particleCount).toBeLessThan(500);
  });
});
