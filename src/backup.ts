import type {Garment,Outfit} from './types';
export interface Backup {app:'angyeopchyeo';exportVersion:2;exportedAt:string;containsImages:true;garments:Garment[];outfits:Outfit[]}
const fail=():never=>{throw new Error('백업 파일 형식이 올바르지 않아. 원본 백업 파일을 선택해줘.')};
const record=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail();
const str=(v:unknown)=>typeof v==='string'?v:fail();
const nonempty=(v:unknown)=>str(v).trim()?str(v):fail();
const choice=<T extends string>(v:unknown,values:readonly T[]):T=>values.includes(v as T)?v as T:fail();
const categories=['TOP','BOTTOM','DRESS','OUTER','SHOES','ACCESSORY'] as const;
const colors=['BLACK','WHITE','GRAY','BEIGE','BROWN','NAVY','BLUE','GREEN','RED','PINK','PURPLE','YELLOW','ORANGE','MULTI'] as const;
const seasons=['SPRING','SUMMER','AUTUMN','WINTER','ALL'] as const;
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:fail();
const nullable=(v:unknown)=>v===null?null:str(v);
const optional=(v:unknown)=>v===undefined?undefined:str(v);
const image=(v:unknown)=>v===undefined?undefined:typeof v==='string'&&/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(v)?v:fail();
const date=(v:unknown)=>{const s=str(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)return fail();return s};
export function parseBackup(value:unknown):Backup {
 const b=record(value);
 if(b.app==='angyeopchyeo'&&b.exportVersion===1)throw new Error('이 파일은 사진이 없는 이전 메타데이터 파일이야. 기존 웹앱에서 사진 포함 전체 백업을 새로 만들어줘.');
 if(b.app!=='angyeopchyeo'||b.exportVersion!==2||b.containsImages!==true)return fail();
 const garments:Garment[]=list(b.garments).map(v=>{const g=record(v);return {id:nonempty(g.id),name:nonempty(g.name),category:choice(g.category,categories),color:choice(g.color,colors),seasons:list(g.seasons).map(s=>choice(s,seasons)),note:str(g.note),status:choice(g.status,['ACTIVE','ARCHIVED'] as const),mainMediaId:nullable(g.mainMediaId),photoDataUrl:image(g.photoDataUrl),createdAt:str(g.createdAt),updatedAt:str(g.updatedAt),deletedAt:optional(g.deletedAt)}});
 const outfits:Outfit[]=list(b.outfits).map(v=>{const o=record(v);if(o.ruleVersion!==1)return fail();return {id:nonempty(o.id),localDate:date(o.localDate),contextName:nonempty(o.contextName),contextKey:str(o.contextKey),note:str(o.note),fullMediaId:nullable(o.fullMediaId),fullPhotoDataUrl:image(o.fullPhotoDataUrl),items:list(o.items).map(v=>{const i=record(v);return {garmentId:nonempty(i.garmentId),name:nonempty(i.name),category:choice(i.category,categories),color:choice(i.color,colors),photoDataUrl:image(i.photoDataUrl)}}),garmentIds:list(o.garmentIds).map(nonempty),combinationKey:str(o.combinationKey),status:choice(o.status,['DRAFT','CONFIRMED'] as const),duplicateKind:o.duplicateKind===undefined?undefined:choice(o.duplicateKind,['none','exact','core','other'] as const),ruleVersion:1,createdAt:str(o.createdAt),updatedAt:str(o.updatedAt),deletedAt:optional(o.deletedAt)}});
 for(const rows of [garments,outfits])if(new Set(rows.map(v=>v.id)).size!==rows.length)return fail();
 for(const o of outfits){const ids=[...new Set(o.garmentIds)].sort((a,b)=>a.localeCompare(b));if(ids.length!==o.garmentIds.length||ids.join('|')!==o.combinationKey||new Set(o.items.map(i=>i.garmentId)).size!==o.items.length||o.items.length!==ids.length||o.items.some(i=>!ids.includes(i.garmentId)))return fail()}
 return {app:'angyeopchyeo',exportVersion:2,exportedAt:str(b.exportedAt),containsImages:true,garments,outfits};
}
