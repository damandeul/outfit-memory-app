import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { recommend } from './domain';
import { deleteGarment, getGarments, saveGarment } from './db';
import type { Garment, Outfit } from './types';

const garment = (id: string, category: Garment['category'], extra: Partial<Garment> = {}): Garment => ({ id, name:id, category, color:'BLACK', seasons:['ALL'], note:'', status:'ACTIVE', mainMediaId:null, createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z', ...extra });
const outfit = (id:string, ids:string[], date:string, createdAt:string):Outfit => ({ id, localDate:date, contextName:'dance', contextKey:'dance', note:'', fullMediaId:null, items:ids.map(garmentId=>({garmentId,name:garmentId,category:garmentId.startsWith('t')?'TOP':'BOTTOM',color:'BLACK'})), garmentIds:[...ids].sort(), combinationKey:[...ids].sort().join('|'), status:'CONFIRMED', ruleVersion:1, createdAt, updatedAt:createdAt });

describe('product contract adversarial acceptance',()=>{
  beforeEach(async()=>{ await new Promise<void>((resolve,reject)=>{ const request=indexedDB.deleteDatabase('angyeopchyeo'); request.onsuccess=()=>resolve(); request.onerror=()=>reject(request.error); request.onblocked=()=>resolve(); }); });
  it('계절 일치 후보가 없어도 다른 계절 후보를 fallback으로 제공한다',()=>{ const result=recommend([garment('winter-top','TOP',{seasons:['WINTER']}),garment('winter-bottom','BOTTOM',{seasons:['WINTER']})],[],{contextName:'dance',targetLocalDate:'2026-07-31',limit:20}); expect(result.length).toBeGreaterThan(0); });
  it('최근 총 등장 횟수가 같으면 등장 핵심 아이템 수가 적은 후보를 먼저 둔다',()=>{ const garments=[garment('tA','TOP'),garment('tB','TOP'),garment('bA','BOTTOM'),garment('bB','BOTTOM')]; const history=[outfit('r1',['tA'],'2026-07-04','2026-07-04T10:00:00.000Z'),outfit('r2',['tA'],'2026-07-03','2026-07-03T10:00:00.000Z'),outfit('r3',['tB'],'2026-07-02','2026-07-02T10:00:00.000Z'),outfit('r4',['bB'],'2026-07-01','2026-07-01T10:00:00.000Z')]; const keys=recommend(garments,history,{contextName:'dance',targetLocalDate:'2026-07-10',limit:20}).map(r=>r.combinationKey); expect(keys.indexOf('bA|tA')).toBeLessThan(keys.indexOf('bB|tB')); });
  it('색상 조화는 보조 아이템이 아닌 핵심 아이템 색상으로 판정한다',()=>{ const result=recommend([garment('red-top','TOP',{color:'RED'}),garment('green-bottom','BOTTOM',{color:'GREEN'}),garment('black-shoes','SHOES',{color:'BLACK'})],[],{contextName:'dance',targetLocalDate:'2026-07-10',limit:20}); const withShoes=result.find(r=>r.garmentIds.includes('black-shoes'))!; expect(withShoes.reasonCodes).not.toContain('COLOR_STRONG'); });
  it('옷 삭제는 deletedAt 기반 소프트 삭제이며 레코드를 보존한다',async()=>{ await saveGarment(garment('soft-delete-me','TOP')); await deleteGarment('soft-delete-me'); const saved=(await getGarments()).find(g=>g.id==='soft-delete-me'); expect(saved).toBeDefined(); expect(saved?.deletedAt).toBeTruthy(); });
});
