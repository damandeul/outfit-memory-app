import { expect, test, type Page } from '@playwright/test';

const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lbMcAAAAAElFTkSuQmCC';

async function openDb(page: Page) {
  await page.goto('/');
}

async function seedDuplicateHistory(page: Page) {
  await page.evaluate(async ({ pixel }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('angyeopchyeo', 1);
      request.onupgradeneeded = () => {
        for (const store of ['garments', 'outfits', 'drafts', 'settings', 'media']) {
          if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, store === 'settings' || store === 'media' ? undefined : { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = '2026-07-01T00:00:00.000Z';
    const garments = [
      { id: 'g-top', name: '검정 상의', category: 'TOP', color: 'BLACK', seasons: ['SPRING', 'SUMMER'], note: '', status: 'ACTIVE', mainMediaId: null, photoDataUrl: pixel, createdAt: now, updatedAt: now },
      { id: 'g-bottom', name: '청바지', category: 'BOTTOM', color: 'BLUE', seasons: ['ALL'], note: '', status: 'ACTIVE', mainMediaId: null, photoDataUrl: pixel, createdAt: now, updatedAt: now },
    ];
    const makeOutfit = (id: string, date: string, createdAt: string, status: 'DRAFT' | 'CONFIRMED', duplicateKind: string) => ({
      id, localDate: date, contextName: '댄스 수업', contextKey: '댄스 수업', note: `${id} 메모`, fullMediaId: null,
      items: garments.map(({ id: garmentId, name, category, color, photoDataUrl }) => ({ garmentId, name, category, color, photoDataUrl })),
      garmentIds: ['g-bottom', 'g-top'], combinationKey: 'g-bottom|g-top', status, duplicateKind, ruleVersion: 1,
      createdAt, updatedAt: createdAt,
    });
    const tx = db.transaction(['garments', 'outfits', 'drafts'], 'readwrite');
    garments.forEach((garment) => tx.objectStore('garments').put(garment));
    tx.objectStore('outfits').put(makeOutfit('confirmed-1', '2026-07-10', '2026-07-10T10:00:00.000Z', 'CONFIRMED', 'none'));
    tx.objectStore('outfits').put(makeOutfit('confirmed-2', '2026-07-17', '2026-07-17T10:00:00.000Z', 'CONFIRMED', 'exact'));
    tx.objectStore('drafts').put(makeOutfit('draft-1', '2026-07-24', '2026-07-20T10:00:00.000Z', 'DRAFT', 'none'));
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, { pixel });
  await page.reload();
}

test('하단 내비게이션 순서와 옷 계절 복수 선택을 보존한다', async ({ page }) => {
  await openDb(page);
  const privacyNotice = page.getByText(/이 기기·이 브라우저에만 로컬 저장/);
  await expect(privacyNotice).toContainText('외부로 전송하지 않아');
  await expect(privacyNotice).toContainText('브라우저 데이터를 지우면 사라질 수 있어');
  const nav = page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button');
  await expect(nav).toHaveText(['다음 만남', '기록', '옷장']);
  await page.getByRole('button', { name: /옷 등록/ }).first().click();
  await page.getByLabel('옷 이름', { exact: true }).fill('복수 계절 상의');
  await page.getByLabel('앨범에서 선택').setInputFiles('e2e/fixtures/garment.png');
  await page.getByLabel('계절 봄').check();
  await expect(page.getByLabel('계절 사계절')).not.toBeChecked();
  await page.getByLabel('계절 여름').check();
  await page.getByLabel('계절 사계절').check();
  await expect(page.getByLabel('계절 봄')).not.toBeChecked();
  await expect(page.getByLabel('계절 여름')).not.toBeChecked();
  await page.getByLabel('계절 봄').check();
  await expect(page.getByLabel('계절 사계절')).not.toBeChecked();
  await page.getByLabel('계절 여름').check();
  await page.getByRole('button', { name: '저장' }).click();
  const saved = await page.evaluate<{ seasons: string[] } | undefined>(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('angyeopchyeo', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const result = await new Promise<Array<{ seasons: string[] }>>((resolve, reject) => { const request = db.transaction('garments').objectStore('garments').getAll(); request.onsuccess = () => resolve(request.result as Array<{ seasons: string[] }>); request.onerror = () => reject(request.error); });
    db.close(); return result[0];
  });
  expect(saved?.seasons).toEqual(['SPRING', 'SUMMER']);
  await page.locator('.card').filter({ hasText: '복수 계절 상의' }).getByRole('button', { name: '수정' }).click();
  await expect(page.getByLabel('계절 봄')).toBeChecked();
  await expect(page.getByLabel('계절 여름')).toBeChecked();
  await expect(page.getByLabel('계절 사계절')).not.toBeChecked();
  await page.getByRole('button', { name: '닫기' }).click();
});

test('중복 초안 override는 DRAFT를 유지하고 정확한 경고와 이전 기록을 표시한다', async ({ page }) => {
  await openDb(page);
  await seedDuplicateHistory(page);
  await page.getByRole('button', { name: '기록' }).click();
  const draft = page.locator('.record').filter({ hasText: '2026-07-24' });
  await draft.getByRole('button', { name: '수정' }).click();
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.getByText('이 수업에서 이전과 완전히 같은 조합이에요.')).toBeVisible();
  await expect(page.getByText('이전 기록 1개')).toBeVisible();
  await page.getByText('이전 기록 1개').click();
  await expect(page.getByText('2026-07-10 · 댄스 수업', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '그대로 저장' }).click();
  const state = await page.evaluate<{ draft?: { status: string; createdAt: string; duplicateKind: string }; confirmed?: { status: string } }>(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('angyeopchyeo', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const get = (store: string, id: string) => new Promise<{ status: string; createdAt: string; duplicateKind: string } | undefined>((resolve, reject) => { const request = db.transaction(store).objectStore(store).get(id); request.onsuccess = () => resolve(request.result as { status: string; createdAt: string; duplicateKind: string } | undefined); request.onerror = () => reject(request.error); });
    const result = { draft: await get('drafts', 'draft-1'), confirmed: await get('outfits', 'draft-1') }; db.close(); return result;
  });
  expect(state.draft?.status).toBe('DRAFT');
  expect(state.draft?.createdAt).toBe('2026-07-20T10:00:00.000Z');
  expect(state.draft?.duplicateKind).toBe('exact');
  expect(state.confirmed).toBeUndefined();
});

test('최근 사용 마지막 날짜와 기록 필터·사진 대체·중복 상태·상세를 제공한다', async ({ page }) => {
  await openDb(page);
  await seedDuplicateHistory(page);
  await page.getByRole('button', { name: '기록' }).click();
  await expect(page.getByLabel('만남/수업명 필터')).toBeVisible();
  const confirmed = page.locator('.record').filter({ hasText: 'confirmed-2 메모' });
  await expect(confirmed.getByText('전체 착장 사진 없음')).toBeVisible();
  await expect(confirmed.getByText('완전 동일 경고')).toBeVisible();
  await expect(confirmed.getByText('상세 보기')).toBeVisible();
  await confirmed.getByText('상세 보기').click();
  await expect(confirmed.getByRole('img', { name: '검정 상의 당시 사진' })).toBeVisible();
  await expect(confirmed.getByRole('img', { name: '청바지 당시 사진' })).toBeVisible();
  await page.getByLabel('만남/수업명 필터').fill('없는 만남');
  await expect(page.getByText('맞는 착장 기록이 없어')).toBeVisible();
  await page.getByLabel('만남/수업명 필터').fill('댄스');
  await page.getByRole('button', { name: '착장 기록', exact: true }).click();
  await page.getByLabel('언제 입었어?').fill('2026-07-24');
  await page.getByLabel('만남이나 수업 이름').fill('댄스 수업');
  await expect(page.getByText('최근 2번 중 2번 · 마지막 2026-07-17').first()).toBeVisible();
});

test('초안 입었어는 확정 시점 중복을 다시 경고하고 exact 상태로 원자 이동한다', async ({ page }) => {
  await openDb(page);
  await seedDuplicateHistory(page);
  await page.getByRole('button', { name: '기록' }).click();
  const draft = page.locator('.record').filter({ hasText: '2026-07-24' });
  await draft.getByRole('button', { name: '입었어' }).click();
  await expect(page.getByRole('alertdialog', { name: '이 수업에서 이전과 완전히 같은 조합이에요.' })).toBeVisible();
  await page.getByRole('button', { name: '입은 것으로 확정' }).click();
  const state = await page.evaluate<{ draft?: unknown; outfit?: { status: string; duplicateKind: string; createdAt: string } }>(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('angyeopchyeo', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const get = (store: string) => new Promise<unknown>((resolve, reject) => { const request = db.transaction(store).objectStore(store).get('draft-1'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const result = { draft: await get('drafts'), outfit: await get('outfits') as { status: string; duplicateKind: string; createdAt: string } | undefined }; db.close(); return result;
  });
  expect(state.draft).toBeUndefined();
  expect(state.outfit).toMatchObject({ status: 'CONFIRMED', duplicateKind: 'exact', createdAt: '2026-07-20T10:00:00.000Z' });
});

test('중복 경고 후 입력 변경은 stale 경고를 폐기하고 현재 상태를 다시 검사한다', async ({ page }) => {
  await openDb(page);
  await seedDuplicateHistory(page);
  await page.getByRole('button', { name: '기록' }).click();
  await page.getByRole('button', { name: '착장 기록', exact: true }).click();
  await page.getByLabel('만남이나 수업 이름').fill('댄스 수업');
  await page.getByLabel('검정 상의').check();
  await page.getByLabel('청바지').check();
  await page.getByRole('button', { name: '중복 확인하고 저장' }).click();
  await expect(page.getByRole('alertdialog', { name: '이 수업에서 이전과 완전히 같은 조합이에요.' })).toBeVisible();
  await page.getByLabel('만남이나 수업 이름').fill('새 수업');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: '중복 확인하고 저장' }).click();
  await expect(page.getByRole('alertdialog', { name: '다른 일정에서 입었던 조합이에요.' })).toBeVisible();
  await page.getByRole('button', { name: '그대로 저장' }).click();
  await expect(page.getByRole('dialog', { name: '착장 기록' })).toHaveCount(0);
  const kind = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('angyeopchyeo', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const records = await new Promise<Array<{ contextName: string; duplicateKind: string }>>((resolve, reject) => { const request = db.transaction('outfits').objectStore('outfits').getAll(); request.onsuccess = () => resolve(request.result as Array<{ contextName: string; duplicateKind: string }>); request.onerror = () => reject(request.error); });
    db.close(); return records.find(record => record.contextName === '새 수업')?.duplicateKind;
  });
  expect(kind).toBe('other');
});

test('후보 없음 회복 CTA는 실제 옷장과 직접 착장 만들기로 이동한다', async ({ page }) => {
  await openDb(page);
  await page.getByRole('button', { name: '다음 만남' }).click();
  await page.getByRole('button', { name: '옷 등록·재활성화' }).click();
  await expect(page.getByRole('heading', { name: '내 옷장' })).toBeVisible();
  await page.getByRole('button', { name: '다음 만남' }).click();
  await page.getByLabel('어떤 만남이야?').fill('직접 기록');
  await page.getByRole('button', { name: '코디 추천받기' }).click();
  await page.getByRole('button', { name: '직접 착장 만들기' }).click();
  await expect(page.getByRole('dialog', { name: '착장 기록' })).toBeVisible();
});

test('착장 편집은 자기 최근 기록을 제외하고 기존 당시 snapshot을 보존한다', async ({ page }) => {
  await openDb(page);
  await page.evaluate(async ({ currentPhoto, oldPhoto }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('angyeopchyeo', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(['garments', 'outfits'], 'readwrite');
    tx.objectStore('garments').put({ id:'item-a', name:'현재 이름 V2', category:'BOTTOM', color:'BLACK', seasons:['ALL'], note:'', status:'ACTIVE', mainMediaId:null, photoDataUrl:currentPhoto, createdAt:'2026-07-01T00:00:00.000Z', updatedAt:'2026-07-02T00:00:00.000Z' });
    tx.objectStore('outfits').put({ id:'past-v1', localDate:'2026-07-01', contextName:'Snapshot 수업', contextKey:'Snapshot 수업', note:'기존 메모', fullMediaId:null, items:[{ garmentId:'item-a', name:'당시 이름 V1', category:'TOP', color:'WHITE', photoDataUrl:oldPhoto }], garmentIds:['item-a'], combinationKey:'item-a', status:'CONFIRMED', duplicateKind:'none', ruleVersion:1, createdAt:'2026-07-01T10:00:00.000Z', updatedAt:'2026-07-01T10:00:00.000Z' });
    await new Promise<void>((resolve, reject) => { tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); }); db.close();
  }, { currentPhoto: pixel, oldPhoto: pixel });
  await page.reload();
  await page.getByRole('button', { name: '기록' }).click();
  await page.getByRole('button', { name: '수정' }).click();
  await page.getByLabel('언제 입었어?').fill('2026-07-08');
  await expect(page.getByText('최근 0번 중 0번 · 마지막 기록 없음')).toBeVisible();
  await page.getByLabel('언제 입었어?').fill('2026-07-01');
  await page.getByLabel('메모').fill('메모만 수정');
  await page.getByRole('button', { name: '수정 저장' }).click();
  await expect(page.getByRole('dialog', { name: '착장 수정' })).toHaveCount(0);
  const snapshot = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request=indexedDB.open('angyeopchyeo',1); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); });
    const value = await new Promise<{ items:Array<{name:string;category:string;color:string;photoDataUrl:string}> }>((resolve,reject)=>{const request=db.transaction('outfits').objectStore('outfits').get('past-v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)}); db.close(); return value.items[0];
  });
  expect(snapshot).toMatchObject({ name:'당시 이름 V1', category:'TOP', color:'WHITE', photoDataUrl:pixel });
  await page.getByRole('button', { name: '옷장' }).click();
  page.once('dialog', dialog => void dialog.accept());
  await page.locator('.card').filter({ hasText:'현재 이름 V2' }).getByRole('button', { name:'삭제' }).click();
  await page.getByRole('button', { name: '기록' }).click();
  await page.getByText('상세 보기').click();
  await expect(page.getByText('당시 이름 V1 · 상의 · 흰색')).toBeVisible();
  await expect(page.getByRole('img', { name:'당시 이름 V1 당시 사진' })).toBeVisible();
});

test('다른 만남의 핵심 동일 추천은 실제 날짜와 만남을 약하게 안내한다', async ({ page }) => {
  await openDb(page);
  await page.evaluate(async ({ photo }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request=indexedDB.open('angyeopchyeo',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error); });
    const now='2026-07-01T00:00:00.000Z'; const tx=db.transaction(['garments','outfits'],'readwrite');
    for(const value of [{id:'top',name:'상의',category:'TOP'},{id:'bottom',name:'하의',category:'BOTTOM'},{id:'new-shoe',name:'새 신발',category:'SHOES'}])tx.objectStore('garments').put({...value,color:'BLACK',seasons:['ALL'],note:'',status:'ACTIVE',mainMediaId:null,photoDataUrl:photo,createdAt:now,updatedAt:now});
    tx.objectStore('outfits').put({id:'other-core',localDate:'2026-07-02',contextName:'다른 수업',contextKey:'다른 수업',note:'',fullMediaId:null,items:[{garmentId:'top',name:'상의',category:'TOP',color:'BLACK'},{garmentId:'bottom',name:'하의',category:'BOTTOM',color:'BLACK'},{garmentId:'old-shoe',name:'구 신발',category:'SHOES',color:'BLACK'}],garmentIds:['bottom','old-shoe','top'],combinationKey:'bottom|old-shoe|top',status:'CONFIRMED',duplicateKind:'none',ruleVersion:1,createdAt:'2026-07-02T10:00:00.000Z',updatedAt:'2026-07-02T10:00:00.000Z'});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close();
  }, { photo:pixel });
  await page.reload(); await page.getByRole('button',{name:'다음 만남'}).click();
  await page.getByLabel('언제 만날 예정이야?').fill('2026-07-10'); await page.getByLabel('어떤 만남이야?').fill('새 수업'); await page.getByRole('button',{name:'코디 추천받기'}).click();
  await expect(page.getByText('다른 일정에서 2026-07-02 · 다른 수업에 같은 핵심 조합을 입었어요').first()).toBeVisible();
});
