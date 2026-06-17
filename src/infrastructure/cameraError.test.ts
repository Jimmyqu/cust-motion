import { describe, expect, it } from 'vitest';
import { describeCameraStartupError } from './cameraError';

describe('describeCameraStartupError', () => {
  it('explains camera permission denial in Chinese', () => {
    expect(describeCameraStartupError(new DOMException('Permission denied', 'NotAllowedError'))).toContain('请允许浏览器访问前置摄像头');
  });

  it('explains missing camera support in Chinese', () => {
    expect(describeCameraStartupError(new Error('This browser does not support camera capture.'))).toContain('当前浏览器不支持摄像头采集');
  });

  it('explains pose model startup failure in Chinese', () => {
    expect(describeCameraStartupError(new Error('model unavailable'))).toBe('姿态识别模型启动失败：model unavailable。可以重试，或先使用模拟模式调试画面和关卡。');
  });
});
