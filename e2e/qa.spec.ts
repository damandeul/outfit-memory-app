import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const qaDir = 'artifacts/qa';
mkdirSync(qaDir, { recursive: true });

function watchRuntime(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function addGarment(page: Page, name: string, category: string) {
  await page.getByRole('button', { name: /옷 등록/ }).first().click();
  await page.getByLabel('옷 이름', { exact: true }).fill(name);
  await page.getByLabel('카테고리').selectOption(category);
  await page.getByLabel('앨범에서 선택').setInputFiles('e2e/fixtures/garment.png');
  await expect(page.getByAltText('선택한 옷 미리보기')).toBeVisible();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function saveOutfit(page: Page, names: string[], date = '2026-07-01', context = '목요일 방송댄스') {
  await page.getByRole('button', { name: '기록' }).click();
  await page.getByRole('button', { name: '착장 기록', exact: true }).click();
  await page.getByLabel('언제 입었어?').fill(date);
  await page.getByLabel('만남이나 수업 이름').fill(context);
  for (const name of names) await page.getByLabel(name).check();
  await page.getByRole('button', { name: '중복 확인하고 저장' }).click();
}

test('카메라 파일 선택 취소와 한국어 IME가 입력 노드·포커스를 보존한다', async ({ page }) => {
  const runtimeErrors = watchRuntime(page);
  await page.goto('/');
  await page.getByRole('button', { name: /옷 등록/ }).first().click();

  const name = page.getByLabel('옷 이름', { exact: true });
  await name.fill('취소 전 입력');
  await page.getByLabel('앨범에서 선택').setInputFiles([]);
  await expect(name).toHaveValue('취소 전 입력');
  await expect(page.getByRole('alert')).toHaveCount(0);

  const handle = await name.elementHandle();
  expect(handle).not.toBeNull();
  await name.focus();
  await name.evaluate(input => {
    const element = input as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    setter?.call(element, '검정 크롭');
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: '롭', inputType: 'insertCompositionText', isComposing: true }));
  });
  expect(await handle!.evaluate(node => node.isConnected)).toBe(true);
  await expect(name).toBeFocused();

  await name.evaluate(input => {
    const element = input as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, '검정 크롭티');
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '티' }));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: '티', inputType: 'insertText', isComposing: false }));
    element.setSelectionRange(element.value.length, element.value.length);
  });
  expect(await handle!.evaluate(node => node.isConnected)).toBe(true);
  await expect(name).toBeFocused();
  await expect(name).toHaveValue('검정 크롭티');
  expect(await name.evaluate(input => (input as HTMLInputElement).selectionStart)).toBe('검정 크롭티'.length);

  await page.getByLabel('앨범에서 선택').setInputFiles('e2e/fixtures/garment.png');
  await expect(page.getByAltText('선택한 옷 미리보기')).toBeVisible();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('검정 크롭티', { exact: true })).toHaveCount(1);
  expect(runtimeErrors).toEqual([]);
});

test('옷 3개 → 착장 → 동일 조합 경고 → 다른 추천 → 새로고침 유지', async ({ page }) => {
  const runtimeErrors = watchRuntime(page);
  const externalRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4174') externalRequests.push(request.url());
  });
  await page.goto('/');
  await addGarment(page, '검정 크롭티', 'TOP');
  await addGarment(page, '청바지', 'BOTTOM');
  await addGarment(page, '흰 셔츠', 'TOP');
  await saveOutfit(page, ['검정 크롭티', '청바지']);
  await expect(page.getByText('목요일 방송댄스')).toBeVisible();

  await page.getByRole('button', { name: '착장 기록', exact: true }).click();
  await page.getByLabel('언제 입었어?').fill('2026-07-08');
  await page.getByLabel('만남이나 수업 이름').fill('목요일 방송댄스');
  await page.getByLabel('청바지').check();
  await page.getByLabel('검정 크롭티').check();
  await page.getByRole('button', { name: '중복 확인하고 저장' }).click();
  await expect(page.getByText('이 조합, 전에 입었어')).toBeVisible();
  await page.getByRole('button', { name: '그대로 저장' }).click();

  await page.getByRole('button', { name: '다음 만남' }).click();
  await page.getByLabel('언제 만날 예정이야?').fill('2026-07-30');
  await page.getByLabel('어떤 만남이야?').fill('목요일 방송댄스');
  await page.getByRole('button', { name: '코디 추천받기' }).click();
  await expect(page.locator('.recommend').filter({ hasText: '흰 셔츠' }).filter({ hasText: '청바지' })).toBeVisible();
  await page.screenshot({ path: `${qaDir}/390-core-flow.png`, fullPage: true });

  await page.reload();
  await page.getByRole('button', { name: '옷장' }).click();
  await expect(page.getByText('검정 크롭티', { exact: true })).toBeVisible();
  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('빈 옷장·원피스 단독·삭제된 아이템 기록·전체 삭제를 안전하게 처리한다', async ({ page }) => {
  const runtimeErrors = watchRuntime(page);
  await page.goto('/');
  await expect(page.getByText('아직 등록한 옷이 없어')).toBeVisible();
  await page.getByRole('button', { name: '기록' }).click();
  await expect(page.getByText('아직 착장 기록이 없어')).toBeVisible();
  await page.getByRole('button', { name: '다음 만남' }).click();
  await expect(page.getByText('추천할 옷이 아직 없어')).toBeVisible();

  await page.getByRole('button', { name: '옷장' }).click();
  await addGarment(page, '검정 원피스', 'DRESS');
  await page.getByRole('button', { name: '다음 만남' }).click();
  await page.getByLabel('언제 만날 예정이야?').fill('2026-08-01');
  await page.getByLabel('어떤 만남이야?').fill('주말 모임');
  await page.getByRole('button', { name: '코디 추천받기' }).click();
  await expect(page.locator('.recommend').filter({ hasText: '검정 원피스' })).toBeVisible();

  await page.getByRole('button', { name: '옷장' }).click();
  await addGarment(page, '삭제할 재킷', 'OUTER');
  await saveOutfit(page, ['검정 원피스', '삭제할 재킷'], '2026-07-15', '저녁 모임');
  await expect(page.getByText('삭제할 재킷')).toBeVisible();
  await page.getByRole('button', { name: '옷장' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.card').filter({ hasText: '삭제할 재킷' }).getByRole('button', { name: '삭제' }).click();
  await expect(page.getByText('삭제할 재킷')).toHaveCount(0);
  await page.getByRole('button', { name: '기록' }).click();
  await expect(page.getByText('삭제할 재킷')).toBeVisible();

  await page.getByRole('button', { name: '설정' }).click();
  await page.getByLabel('삭제하려면 “안겹쳐” 입력').fill('안겹쳐');
  await page.getByRole('button', { name: '모든 데이터 삭제' }).click();
  await expect(page.getByText('아직 등록한 옷이 없어')).toBeVisible();
  await page.reload();
  await expect(page.getByText('아직 등록한 옷이 없어')).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

for (const viewport of [
  { width: 390, height: 844, name: '390' },
  { width: 768, height: 900, name: '768' },
  { width: 1440, height: 1000, name: '1440' },
]) {
  test(`${viewport.name}px 반응형·44px 터치·콘솔 오류 검증`, async ({ page }) => {
    const runtimeErrors = watchRuntime(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
    const undersized = await page.locator('button, input, select, textarea').evaluateAll(elements => elements
      .filter(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, label: element.getAttribute('aria-label') || element.textContent || '', width: rect.width, height: rect.height };
      })
      .filter(item => item.width < 44 || item.height < 44));
    expect(undersized).toEqual([]);
    await page.screenshot({ path: `${qaDir}/${viewport.name}-empty-closet.png`, fullPage: true });
    expect(runtimeErrors).toEqual([]);
  });
}

test('production service worker가 오프라인 앱 셸을 제공한다', async ({ page, context }) => {
  const runtimeErrors = watchRuntime(page);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '내 옷장' })).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
  await page.screenshot({ path: `${qaDir}/390-offline-shell.png`, fullPage: true });
  expect(runtimeErrors).toEqual([]);
});
