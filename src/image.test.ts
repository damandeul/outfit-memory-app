import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressPhoto } from './image';

describe('photo input validation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('허용하지 않는 image MIME은 디코딩 전에 거절한다', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    const svg = new File(['<svg/>'], 'unsafe.svg', { type: 'image/svg+xml' });
    await expect(compressPhoto(svg)).rejects.toThrow('JPG, PNG, WebP');
    expect(decode).not.toHaveBeenCalled();
  });

  it('25MB 초과 파일은 디코딩 전에 거절한다', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    const oversized = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' });
    await expect(compressPhoto(oversized)).rejects.toThrow('25MB 이하');
    expect(decode).not.toHaveBeenCalled();
  });

  it('허용 형식의 이미지 디코딩 실패를 사용자 오류로 변환한다', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')));
    const broken = new File(['broken'], 'broken.webp', { type: 'image/webp' });
    await expect(compressPhoto(broken)).rejects.toThrow('이 사진을 열지 못했어');
  });
});
