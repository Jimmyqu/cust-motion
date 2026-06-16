import { describe, expect, it } from 'vitest';
import { isWebGLSupported } from './webglSupport';

describe('isWebGLSupported', () => {
  it('returns true when a canvas can create a WebGL context', () => {
    const doc = {
      createElement: () => ({
        getContext: (kind: string) => (kind === 'webgl' ? {} : null),
      }),
    };

    expect(isWebGLSupported(doc)).toBe(true);
  });

  it('returns false when canvas creation or WebGL context creation fails', () => {
    const withoutContext = {
      createElement: () => ({
        getContext: () => null,
      }),
    };
    const throwingDocument = {
      createElement: () => {
        throw new Error('canvas unavailable');
      },
    };

    expect(isWebGLSupported(withoutContext)).toBe(false);
    expect(isWebGLSupported(throwingDocument)).toBe(false);
  });
});
