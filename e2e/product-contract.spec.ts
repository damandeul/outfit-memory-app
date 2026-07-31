import { expect, test, type Page } from '@playwright/test';

async function addNoPhoto(page: Page, name: string, category: string) {
  await page.getByRole('button', { name: /옷 등록/ }).first().click();
  await page.getByLabel('옷 이름', { exact: true }).fill(name);
  await page.getByLabel('카테고리').selectOption(category);
  await page.getByRole('button', { name: '저장' }).click();
}

async function addWithPhoto(page: Page, name: string, category: string, options: { color?: string; season?: string } = {}) {
  await page.getByRole('button', { name: /옷 등록/ }).first().click();
  await page.getByLabel('옷 이름', { exact: true }).fill(name);
  await page.getByLabel('카테고리').selectOption(category);
  if (options.color) await page.getByLabel('주색상').selectOption(options.color);
  if (options.season) await page.getByLabel('계절').selectOption(options.season);
  await page.getByLabel('앨범에서 선택').setInputFiles('e2e/fixtures/garment.png');
  await expect(page.getByAltText('선택한 옷 미리보기')).toBeVisible();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

test('옷 사진 필수 계약: 사진 없이 저장할 수 없다', async ({ page }) => {
  await page.goto('/');
  await addNoPhoto(page, '사진 없는 상의', 'TOP');
  await expect(page.getByRole('alert')).toContainText('사진');
  await expect(page.getByText('사진 없는 상의', { exact: true })).toHaveCount(0);
});

test('후보가 3개를 넘으면 다음 페이지로 탐색할 수 있다', async ({ page }) => {
  await page.goto('/');
  for (const [name, category] of [['상의 A','TOP'],['상의 B','TOP'],['하의 A','BOTTOM'],['하의 B','BOTTOM']] as const) {
    await addWithPhoto(page, name, category);
  }
  await page.getByRole('button', { name: '다음 만남' }).click();
  await page.getByLabel('언제 만날 예정이야?').fill('2026-07-31');
  await page.getByLabel('어떤 만남이야?').fill('적대적 QA');
  await page.getByRole('button', { name: '코디 추천받기' }).click();
  await expect(page.locator('.recommend')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /다른 (후보|추천) 보기/ })).toBeVisible();
  await page.getByRole('button', { name: /다른 (후보|추천) 보기/ }).click();
  await expect(page.locator('.recommend')).toHaveCount(1);
  await expect(page.getByText('가능한 후보를 모두 봤어요')).toBeVisible();
  await page.getByRole('button', { name: '처음부터 보기' }).click();
  await expect(page.locator('.recommend')).toHaveCount(3);
});

test('계절·색상 확인 안내와 3개 하단 내비게이션을 제공한다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button')).toHaveCount(3);
  await expect(page.locator('header').getByRole('button', { name: '설정' })).toBeVisible();
  await addWithPhoto(page, '빨강 상의', 'TOP', { color: 'RED', season: 'SPRING' });
  await addWithPhoto(page, '초록 하의', 'BOTTOM', { color: 'GREEN', season: 'SPRING' });
  await page.getByRole('button', { name: '다음 만남' }).click();
  await page.getByLabel('언제 만날 예정이야?').fill('2026-12-31');
  await page.getByLabel('어떤 만남이야?').fill('겨울 모임');
  await page.getByRole('button', { name: '코디 추천받기' }).click();
  await expect(page.getByText('계절 정보가 맞는지 확인해 주세요')).toBeVisible();
  await expect(page.getByText('색상 조합은 직접 확인해 주세요')).toBeVisible();
});

test('추천 초안은 기록에서 실제 착용 확정 및 수정할 수 있다', async ({ page }) => {
  await page.goto('/');
  await addWithPhoto(page, '초안 상의', 'TOP');
  await addWithPhoto(page, '초안 하의', 'BOTTOM');
  await page.getByRole('button', { name: '다음 만남' }).click();
  await page.getByLabel('언제 만날 예정이야?').fill('2026-07-31');
  await page.getByLabel('어떤 만남이야?').fill('초안 QA');
  await page.getByRole('button', { name: '코디 추천받기' }).click();
  await page.getByRole('button', { name: '이 코디로 준비' }).first().click();
  await page.getByRole('button', { name: '착장 초안 저장' }).click();
  await page.getByRole('button', { name: '기록' }).click();
  const draft = page.locator('.record').filter({ hasText: '초안 QA' });
  await expect(draft.getByRole('button', { name: /입었어|착용 완료/ })).toBeVisible();
  await expect(draft.getByRole('button', { name: '수정' })).toBeVisible();

  await draft.getByRole('button', { name: '수정' }).click();
  await expect(page.getByRole('heading', { name: '착장 수정' })).toBeVisible();
  await page.getByLabel('만남이나 수업 이름').fill('수정된 초안 QA');
  await page.getByRole('button', { name: '수정 저장' }).click();
  const edited = page.locator('.record').filter({ hasText: '수정된 초안 QA' });
  await expect(edited).toHaveCount(1);
  await edited.getByRole('button', { name: '입었어' }).click();
  await expect(edited.getByText('착용 완료', { exact: true })).toBeVisible();
  await expect(edited.getByRole('button', { name: '입었어' })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: '기록' }).click();
  await expect(page.locator('.record').filter({ hasText: '수정된 초안 QA' }).getByText('착용 완료', { exact: true })).toBeVisible();
});
