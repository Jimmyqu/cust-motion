interface FullscreenRoot {
  requestFullscreen?: () => Promise<void>;
}

interface OrientationController {
  lock?: (orientation: 'landscape') => Promise<void>;
}

export interface ImmersiveDisplayOptions {
  root?: FullscreenRoot;
  orientation?: OrientationController;
}

export interface ImmersiveDisplayResult {
  fullscreen: boolean;
  orientationLocked: boolean;
  warnings: string[];
}

export async function requestLandscapeImmersion(options: ImmersiveDisplayOptions = {}): Promise<ImmersiveDisplayResult> {
  const root = options.root ?? document.documentElement;
  const orientation = options.orientation ?? (screen.orientation as OrientationController | undefined) ?? {};
  const warnings: string[] = [];
  let fullscreen = false;
  let orientationLocked = false;

  if (root.requestFullscreen) {
    try {
      await root.requestFullscreen();
      fullscreen = true;
    } catch (error) {
      warnings.push(`fullscreen failed: ${readableError(error)}`);
    }
  } else {
    warnings.push('fullscreen unsupported');
  }

  if (orientation.lock) {
    try {
      await orientation.lock('landscape');
      orientationLocked = true;
    } catch (error) {
      warnings.push(`orientation lock failed: ${readableError(error)}`);
    }
  } else {
    warnings.push('orientation lock unsupported');
  }

  return { fullscreen, orientationLocked, warnings };
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
