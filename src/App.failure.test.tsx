import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  clearAll: vi.fn(),
  deleteGarment: vi.fn(),
  deleteOutfit: vi.fn(),
  exportMetadata: vi.fn(),
  getGarments: vi.fn(),
  getOutfits: vi.fn(),
  saveGarment: vi.fn(),
  saveOutfit: vi.fn(),
}));
const image = vi.hoisted(() => ({ compressPhoto: vi.fn() }));

vi.mock('./db', () => db);
vi.mock('./image', () => image);

import App from './App';
import type { Garment, Outfit } from './types';

const now = '2026-07-30T00:00:00.000Z';
const top: Garment = {
  id: 'top', name: '검정 크롭티', category: 'TOP', color: 'BLACK', seasons: ['ALL'], note: '',
  status: 'ACTIVE', mainMediaId: null, createdAt: now, updatedAt: now,
};
const bottom: Garment = {
  id: 'bottom', name: '청바지', category: 'BOTTOM', color: 'BLUE', seasons: ['ALL'], note: '',
  status: 'ACTIVE', mainMediaId: null, createdAt: now, updatedAt: now,
};
const prior: Outfit = {
  id: 'prior', localDate: '2026-07-01', contextName: '목요일 방송댄스', contextKey: '목요일 방송댄스',
  note: '', fullMediaId: null, items: [
    { garmentId: top.id, name: top.name, category: top.category, color: top.color },
    { garmentId: bottom.id, name: bottom.name, category: bottom.category, color: bottom.color },
  ], garmentIds: ['bottom', 'top'], combinationKey: 'bottom|top', status: 'CONFIRMED', ruleVersion: 1,
  createdAt: now, updatedAt: now,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.getGarments.mockResolvedValue([]);
  db.getOutfits.mockResolvedValue([]);
  db.saveGarment.mockResolvedValue('id');
  db.saveOutfit.mockResolvedValue('id');
  db.clearAll.mockResolvedValue(undefined);
  db.exportMetadata.mockResolvedValue({});
  image.compressPhoto.mockResolvedValue('data:image/webp;base64,processed');
});

describe('recoverable storage and photo failures', () => {
  it('shows an IndexedDB load failure and can retry without a blank crash', async () => {
    db.getGarments.mockRejectedValueOnce(new Error('database unavailable'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('저장한 기록을 불러오지 못했어');
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByText('아직 등록한 옷이 없어')).toBeInTheDocument();
  });

  it('keeps garment input and re-enables save when IndexedDB write fails', async () => {
    db.saveGarment.mockRejectedValueOnce(new Error('quota'));
    render(<App />);
    await screen.findByText('아직 등록한 옷이 없어');
    fireEvent.click(screen.getByRole('button', { name: '옷 등록' }));
    fireEvent.change(screen.getByLabelText('옷 이름'), { target: { value: '검정 크롭티' } });
    fireEvent.change(screen.getByLabelText('앨범에서 선택'), { target: { files: [new File(['photo'], 'garment.jpg', { type: 'image/jpeg' })] } });
    await screen.findByAltText('선택한 옷 미리보기');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했어');
    expect(screen.getByLabelText('옷 이름')).toHaveValue('검정 크롭티');
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });

  it('waits for garment photo processing and saves the processed photo', async () => {
    let resolvePhoto!: (value: string) => void;
    image.compressPhoto.mockImplementation(() => new Promise<string>(resolve => { resolvePhoto = resolve; }));
    render(<App />);
    await screen.findByText('아직 등록한 옷이 없어');
    fireEvent.click(screen.getByRole('button', { name: '옷 등록' }));
    fireEvent.change(screen.getByLabelText('옷 이름'), { target: { value: '검정 크롭티' } });
    const file = new File(['photo'], 'outfit.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('카메라로 촬영'), { target: { files: [file] } });
    const processing = await screen.findByRole('button', { name: '사진 준비 중…' });
    expect(processing).toBeDisabled();
    fireEvent.submit(processing.closest('form')!);
    expect(db.saveGarment).not.toHaveBeenCalled();
    resolvePhoto('data:image/webp;base64,processed');
    const save = await screen.findByRole('button', { name: '저장' });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(db.saveGarment).toHaveBeenCalledWith(expect.objectContaining({
      photoDataUrl: 'data:image/webp;base64,processed',
    })));
  });

  it('suggests a garment name after a camera photo when the name is empty', async () => {
    image.compressPhoto.mockResolvedValueOnce('data:image/webp;base64,processed');
    render(<App />);
    await screen.findByText('아직 등록한 옷이 없어');
    fireEvent.click(screen.getByRole('button', { name: '옷 등록' }));
    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: 'OUTER' } });
    fireEvent.change(screen.getByLabelText('주색상'), { target: { value: 'BLUE' } });
    const file = new File(['photo'], 'jacket.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('카메라로 촬영'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText('옷 이름')).toHaveValue('파랑 아우터'));
  });

  it('uses the latest tags when photo processing finishes', async () => {
    let resolvePhoto!: (value: string) => void;
    image.compressPhoto.mockImplementation(() => new Promise<string>(resolve => { resolvePhoto = resolve; }));
    render(<App />);
    await screen.findByText('아직 등록한 옷이 없어');
    fireEvent.click(screen.getByRole('button', { name: '옷 등록' }));
    const file = new File(['photo'], 'jacket.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('카메라로 촬영'), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: 'OUTER' } });
    fireEvent.change(screen.getByLabelText('주색상'), { target: { value: 'BLUE' } });
    resolvePhoto('data:image/webp;base64,processed');
    await waitFor(() => expect(screen.getByLabelText('옷 이름')).toHaveValue('파랑 아우터'));
  });

  it('updates an automatic name with tags until the user edits it', async () => {
    image.compressPhoto.mockResolvedValueOnce('data:image/webp;base64,processed');
    render(<App />);
    await screen.findByText('아직 등록한 옷이 없어');
    fireEvent.click(screen.getByRole('button', { name: '옷 등록' }));
    const file = new File(['photo'], 'jacket.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('카메라로 촬영'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText('옷 이름')).toHaveValue('검정 상의'));
    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: 'OUTER' } });
    fireEvent.change(screen.getByLabelText('주색상'), { target: { value: 'BLUE' } });
    expect(screen.getByLabelText('옷 이름')).toHaveValue('파랑 아우터');
    fireEvent.change(screen.getByLabelText('옷 이름'), { target: { value: '내 청재킷' } });
    fireEvent.change(screen.getByLabelText('주색상'), { target: { value: 'RED' } });
    expect(screen.getByLabelText('옷 이름')).toHaveValue('내 청재킷');
  });

  it('shows outfit photo decode failure while preserving date, context and selections', async () => {
    db.getGarments.mockResolvedValue([top]);
    image.compressPhoto.mockRejectedValueOnce(new Error('이 사진을 열지 못했어.'));
    render(<App />);
    await screen.findByText('검정 크롭티');
    fireEvent.click(screen.getByRole('button', { name: '기록' }));
    fireEvent.click(screen.getByRole('button', { name: '착장 기록' }));
    fireEvent.change(screen.getByLabelText('만남이나 수업 이름'), { target: { value: '목요일 방송댄스' } });
    fireEvent.click(screen.getByLabelText('검정 크롭티'));
    const file = new File(['broken'], 'broken.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('전체 착장 사진 (선택)'), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('이 사진을 열지 못했어');
    expect(screen.getByLabelText('만남이나 수업 이름')).toHaveValue('목요일 방송댄스');
    expect(screen.getByLabelText('검정 크롭티')).toBeChecked();
  });

  it('blocks duplicate override until the outfit photo is processed', async () => {
    db.getGarments.mockResolvedValue([top, bottom]);
    db.getOutfits.mockResolvedValue([prior]);
    let resolvePhoto!: (value: string) => void;
    image.compressPhoto.mockImplementation(() => new Promise<string>(resolve => { resolvePhoto = resolve; }));
    render(<App />);
    await screen.findByText('검정 크롭티');
    fireEvent.click(screen.getByRole('button', { name: '기록' }));
    fireEvent.click(screen.getByRole('button', { name: '착장 기록' }));
    fireEvent.change(screen.getByLabelText('만남이나 수업 이름'), { target: { value: '목요일 방송댄스' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /검정 크롭티/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /청바지/ }));
    fireEvent.click(screen.getByRole('button', { name: '중복 확인하고 저장' }));
    const confirm = await screen.findByRole('button', { name: '그대로 저장' });
    const file = new File(['photo'], 'outfit.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('전체 착장 사진 (선택)'), { target: { files: [file] } });
    expect(await screen.findByRole('button', { name: '사진 준비 중…' })).toBeDisabled();
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(db.saveOutfit).not.toHaveBeenCalled();
    resolvePhoto('data:image/webp;base64,processed-outfit');
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(db.saveOutfit).toHaveBeenCalledWith(expect.objectContaining({
      fullPhotoDataUrl: 'data:image/webp;base64,processed-outfit',
    })));
  });

  it('saves a warned duplicate only once when the confirmation is clicked repeatedly', async () => {
    db.getGarments.mockResolvedValue([top, bottom]);
    db.getOutfits.mockResolvedValue([prior]);
    let resolveSave!: () => void;
    db.saveOutfit.mockImplementation(() => new Promise<void>(resolve => { resolveSave = resolve; }));
    render(<App />);
    await screen.findByText('검정 크롭티');
    fireEvent.click(screen.getByRole('button', { name: '기록' }));
    fireEvent.click(screen.getByRole('button', { name: '착장 기록' }));
    fireEvent.change(screen.getByLabelText('만남이나 수업 이름'), { target: { value: '목요일 방송댄스' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /검정 크롭티/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /청바지/ }));
    fireEvent.click(screen.getByRole('button', { name: '중복 확인하고 저장' }));
    const confirm = await screen.findByRole('button', { name: '그대로 저장' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(db.saveOutfit).toHaveBeenCalledTimes(1);
    resolveSave();
    await waitFor(() => expect(db.getOutfits).toHaveBeenCalled());
  });
});
