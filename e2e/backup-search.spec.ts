import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
test('기존 웹 저장소 → 사진 포함 파일 → 전체 삭제 → 복원 및 검색',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'내 옷장',exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6oJkAAAAASUVORK5CYII=';
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('angyeopchyeo',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const tx=db.transaction(['garments','outfits','drafts'],'readwrite');
  const g={id:'legacy-shirt',name:'린넨 셔츠',category:'TOP',color:'BLACK',seasons:['SUMMER'],note:'출근용',status:'ACTIVE',mainMediaId:null,photoDataUrl:photo,createdAt:'2026-11-10T00:00:00Z',updatedAt:'2026-11-10T00:00:00Z'};
  tx.objectStore('garments').put(g);
  const o={id:'legacy-record',localDate:'2026-11-10',contextName:'댄스',contextKey:'댄스',note:'발표회',fullMediaId:null,fullPhotoDataUrl:photo,items:[{garmentId:g.id,name:g.name,category:g.category,color:g.color,photoDataUrl:photo}],garmentIds:[g.id],combinationKey:g.id,status:'CONFIRMED',ruleVersion:1,createdAt:g.createdAt,updatedAt:g.updatedAt};
  tx.objectStore('outfits').put(o);tx.objectStore('drafts').put({...o,id:'legacy-draft',status:'DRAFT'});
  await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close();
 });
 await page.reload();await page.getByRole('button',{name:'설정',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'사진 포함 전체 백업',exact:true}).click();const file=await download;const path=await file.path();const content=await fs.readFile(path!,'utf8');const backup=JSON.parse(content);
 expect(backup.garments[0].photoDataUrl).toContain('data:image/png');expect(backup.outfits).toHaveLength(2);expect(backup.outfits[0].items[0].photoDataUrl).toBe(backup.garments[0].photoDataUrl);
 await page.getByLabel('삭제하려면 “안겹쳐” 입력').fill('안겹쳐');await page.getByRole('button',{name:'모든 데이터 삭제',exact:true}).click();await expect(page.getByText('아직 등록한 옷이 없어')).toBeVisible();
 await page.getByRole('button',{name:'설정',exact:true}).click();page.once('dialog',dialog=>dialog.accept());await page.getByLabel('전체 백업 복원').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(content)});
 await expect(page.getByRole('heading',{name:'린넨 셔츠',exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'린넨 셔츠 사진'})).toHaveAttribute('src',backup.garments[0].photoDataUrl);
 await page.getByLabel('옷 이름 검색').fill('블랙 여름 출근');await expect(page.getByRole('heading',{name:'린넨 셔츠',exact:true})).toBeVisible();await page.getByLabel('계절',{exact:true}).selectOption('WINTER');await expect(page.getByText('맞는 옷이 없어')).toBeVisible();await page.getByRole('button',{name:'검색 초기화'}).click();await page.getByLabel('옷 이름 검색').fill('ㄹㄴㅅㅊ');await expect(page.getByRole('heading',{name:'린넨 셔츠',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'기록',exact:true}).click();await page.getByLabel('만남/수업명 필터').fill('린넨셔츠 발표회');await expect(page.getByRole('heading',{name:'댄스',exact:true})).toHaveCount(2);await page.getByLabel('기록 상태',{exact:true}).selectOption('DRAFT');await expect(page.getByRole('heading',{name:'댄스',exact:true})).toHaveCount(1);
});
