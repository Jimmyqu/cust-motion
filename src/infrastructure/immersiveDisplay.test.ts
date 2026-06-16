import { describe, expect, it, vi } from 'vitest';
import { requestLandscapeImmersion } from './immersiveDisplay';

describe('requestLandscapeImmersion', () => {
  it('requests fullscreen and locks landscape when the browser supports both', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const lock = vi.fn().mockResolvedValue(undefined);

    const result = await requestLandscapeImmersion({
      root: { requestFullscreen },
      orientation: { lock },
    });

    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(lock).toHaveBeenCalledWith('landscape');
    expect(result).toEqual({ fullscreen: true, orientationLocked: true, warnings: [] });
  });

  it('reports unsupported APIs without blocking play', async () => {
    const result = await requestLandscapeImmersion({ root: {}, orientation: {} });

    expect(result.fullscreen).toBe(false);
    expect(result.orientationLocked).toBe(false);
    expect(result.warnings).toEqual(['fullscreen unsupported', 'orientation lock unsupported']);
  });

  it('captures browser rejections as warnings instead of throwing', async () => {
    const result = await requestLandscapeImmersion({
      root: { requestFullscreen: vi.fn().mockRejectedValue(new Error('gesture required')) },
      orientation: { lock: vi.fn().mockRejectedValue(new Error('not allowed')) },
    });

    expect(result.fullscreen).toBe(false);
    expect(result.orientationLocked).toBe(false);
    expect(result.warnings).toEqual(['fullscreen failed: gesture required', 'orientation lock failed: not allowed']);
  });
});
