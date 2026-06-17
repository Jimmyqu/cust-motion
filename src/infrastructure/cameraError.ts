export function describeCameraStartupError(error: unknown): string {
  if (isDomException(error, 'NotAllowedError') || messageIncludes(error, 'Permission denied')) {
    return '请允许浏览器访问前置摄像头，然后重试。也可以先使用模拟模式调试画面和关卡。';
  }

  if (isDomException(error, 'NotFoundError') || messageIncludes(error, 'Requested device not found')) {
    return '没有找到可用的摄像头。请确认手机前置摄像头可用，或先使用模拟模式调试。';
  }

  if (messageIncludes(error, 'does not support camera capture')) {
    return '当前浏览器不支持摄像头采集。请换用支持 WebRTC 的移动浏览器，或先使用模拟模式调试。';
  }

  return `姿态识别模型启动失败：${readableError(error)}。可以重试，或先使用模拟模式调试画面和关卡。`;
}

function isDomException(error: unknown, name: string): boolean {
  return error instanceof DOMException && error.name === name;
}

function messageIncludes(error: unknown, search: string): boolean {
  return readableError(error).includes(search);
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
