import {beforeEach,describe,expect,it} from 'vitest';
import {clearAll,exportBackup,getGarments,getOutfits,restoreBackup,saveGarment,saveOutfit} from './db';
import {parseBackup} from './backup';
import type {Garment,Outfit} from './types';
const photo='data:image/png;base64,aGVsbG8=';
const g:Garment={id:'g1',name:'검정 셔츠',category:'TOP',color:'BLACK',seasons:['ALL'],note:'출근',status:'ACTIVE',mainMediaId:null,photoDataUrl:photo,createdAt:'2026-11-10T00:00:00Z',updatedAt:'2026-11-10T00:00:00Z'};
const o:Outfit={id:'o1',localDate:'2026-11-10',contextName:'댄스',contextKey:'댄스',note:'발표',fullMediaId:null,fullPhotoDataUrl:photo,items:[{garmentId:g.id,name:g.name,category:g.category,color:g.color,photoDataUrl:photo}],garmentIds:[g.id],combinationKey:g.id,status:'CONFIRMED',ruleVersion:1,createdAt:g.createdAt,updatedAt:g.updatedAt};
beforeEach(clearAll);
describe('사진 포함 백업과 복원',()=>{
 it('JSON 왕복 후 옷·전체 착장·과거 사진·초안을 그대로 복원한다',async()=>{await saveGarment(g);await saveOutfit(o);await saveOutfit({...o,id:'draft',status:'DRAFT'});const data=JSON.parse(JSON.stringify(await exportBackup()));await clearAll();await restoreBackup(data);expect(await getGarments()).toEqual([g]);expect(await getOutfits()).toEqual(expect.arrayContaining([o,{...o,id:'draft',status:'DRAFT'}]));expect(await exportBackup()).toMatchObject({containsImages:true,exportVersion:2})});
 it('복원은 기존 데이터를 대체한다',async()=>{await saveGarment({...g,id:'old'});await restoreBackup({app:'angyeopchyeo',exportVersion:2,containsImages:true,exportedAt:g.createdAt,garments:[g],outfits:[o]});expect((await getGarments()).map(v=>v.id)).toEqual(['g1'])});
 it('손상 파일은 기존 데이터를 지우지 않는다',async()=>{await saveGarment(g);const data=await exportBackup();await expect(restoreBackup({...data,garments:[{...g,photoDataUrl:'https://invalid/image.png'}]})).rejects.toThrow();expect(await getGarments()).toEqual([g]);await expect(restoreBackup({...data,garments:[g,g]})).rejects.toThrow();expect(await getGarments()).toEqual([g])});
 it('사진 없는 구형 메타데이터와 미래 버전을 명확히 거부한다',()=>{expect(()=>parseBackup({app:'angyeopchyeo',exportVersion:1})).toThrow('사진이 없는');expect(()=>parseBackup({app:'angyeopchyeo',exportVersion:3})).toThrow()});
 it('기록과 아이템 연결이 손상되면 거부한다',async()=>{const data=await exportBackup();expect(()=>parseBackup({...data,outfits:[{...o,garmentIds:['different']}]})).toThrow()});
 it('쓰기 실패 시 트랜잭션 전체를 취소한다',async()=>{await saveGarment(g);const data=await exportBackup();const {openDB}=await import('idb');const db=await openDB('angyeopchyeo',1);const native=IDBObjectStore.prototype.put;let writes=0;IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(++writes===2)throw new DOMException('full','QuotaExceededError');return native.apply(this,args)};try{await expect(restoreBackup({...data,garments:[{...g,id:'new1'},{...g,id:'new2'}]})).rejects.toThrow();expect(await getGarments()).toEqual([g])}finally{IDBObjectStore.prototype.put=native;db.close()}});
});
