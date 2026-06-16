interface CanvasLike {
  getContext(contextId: string): unknown;
}

interface DocumentLike {
  createElement(tagName: 'canvas'): CanvasLike;
}

export function isWebGLSupported(doc: DocumentLike = document): boolean {
  try {
    const canvas = doc.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
