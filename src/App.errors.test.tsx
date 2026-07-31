import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGarments: vi.fn(),
  getOutfits: vi.fn(),
  saveGarment: vi.fn(),
  saveOutfit: vi.fn(),
  deleteGarment: vi.fn(),
  deleteOutfit: vi.fn(),
  clearAll: vi.fn(),
  exportMetadata: vi.fn(),
  compressPhoto: vi.fn(),
}));

vi.mock('./db', () => ({
  getGarments: mocks.getGarments,
  getOutfits: mocks.getOutfits,
  saveGarment: mocks.saveGarment,
  saveOutfit: mocks.saveOutfit,
  deleteGarment: mocks.deleteGarment,
  deleteOutfit: mocks.deleteOutfit,
  clearAll: mocks.clearAll,
  exportMetadata: mocks.exportMetadata,
}));
vi.mock('./image', () => ({ compressPhoto: mocks.compressPhoto }));

import App from './App';

const garment = {
  id: 'top-1', name: '검정 상의', category: 'TOP' as const, color: 'BLACK' as const,
  seasons: ['ALL' as const], note: '', status: 'ACTIVE' as const, mainMediaId: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('recoverable persistence and image errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGarments.mockResolvedValue([]);
    mocks.getOutfits.mockResolvedValue([]);
    mocks.saveGarment.mockResolvedValue('ok');
    mocks.saveOutfit.mockResolvedValue('ok');
    mocks.compressPhoto.mockResolvedValue('data:image/webp;base64,processed');
  });

  it('초기 IndexedDB 조회 실패를 오류 UI와 재시도로 복구한다', async () => {
    mocks.getGarments.mockRejectedValueOnce(new Error('blocked'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('저장한 기록을 불러오지 못했어');
    mocks.getGarments.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    await waitFor(() => expect(mocks.getGarments).toHaveBeenCalledTimes(2));
  });

  it('옷 저장 실패 시 입력을 유지하고 재시도 오류를 표시한다', async () => {
    mocks.saveGarment.mockRejectedValueOnce(new Error('quota'));
    render(<App />);
    await screen.findByText('아직 등록한 옷이 없어');
    fireEvent.click(screen.getByRole('button', { name: '옷 등록' }));
    fireEvent.change(screen.getByLabelText('옷 이름'), { target: { value: '실패해도 유지' } });
    fireEvent.change(screen.getByLabelText('앨범에서 선택'), { target: { files: [new File(['photo'], 'garment.jpg', { type: 'image/jpeg' })] } });
    await screen.findByAltText('선택한 옷 미리보기');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했어');
    expect(screen.getByLabelText('옷 이름')).toHaveValue('실패해도 유지');
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });

  it('착장 사진 디코딩 실패를 폼 안의 복구 가능한 오류로 표시한다', async () => {
    mocks.getGarments.mockResolvedValue([garment]);
    mocks.compressPhoto.mockRejectedValueOnce(new Error('이 사진을 열지 못했어. JPG, PNG, WebP로 다시 골라줘.'));
    render(<App />);
    await screen.findByText('검정 상의');
    fireEvent.click(screen.getByRole('button', { name: '기록' }));
    fireEvent.click(screen.getByRole('button', { name: '착장 기록' }));
    fireEvent.change(screen.getByLabelText('전체 착장 사진 (선택)'), {
      target: { files: [new File(['broken'], 'broken.webp', { type: 'image/webp' })] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('이 사진을 열지 못했어');
    expect(screen.getAllByRole('heading', { name: '착장 기록' }).length).toBeGreaterThan(0);
  });

  it('착장 저장을 연속 제출해도 IndexedDB write는 한 번만 시작한다', async () => {
    mocks.getGarments.mockResolvedValue([garment]);
    let resolveSave: (() => void) | undefined;
    mocks.saveOutfit.mockImplementation(() => new Promise<void>(resolve => { resolveSave = resolve; }));
    render(<App />);
    await screen.findByText('검정 상의');
    fireEvent.click(screen.getByRole('button', { name: '기록' }));
    fireEvent.click(screen.getByRole('button', { name: '착장 기록' }));
    fireEvent.change(screen.getByLabelText('만남이나 수업 이름'), { target: { value: '댄스' } });
    fireEvent.click(screen.getByLabelText('검정 상의'));
    const submit = screen.getByRole('button', { name: '중복 확인하고 저장' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(mocks.saveOutfit).toHaveBeenCalledTimes(1);
    resolveSave?.();
    await waitFor(() => expect(mocks.getOutfits).toHaveBeenCalled());
  });
});
