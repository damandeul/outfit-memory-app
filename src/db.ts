import { openDB, type DBSchema } from 'idb';
import type { Garment, Outfit } from './types';
interface Schema extends DBSchema { garments:{key:string;value:Garment}; outfits:{key:string;value:Outfit}; drafts:{key:string;value:Outfit}; settings:{key:string;value:unknown}; media:{key:string;value:Blob} }
const database=()=>openDB<Schema>('angyeopchyeo',1,{upgrade(db){db.createObjectStore('garments',{keyPath:'id'});db.createObjectStore('outfits',{keyPath:'id'});db.createObjectStore('drafts',{keyPath:'id'});db.createObjectStore('settings');db.createObjectStore('media')}});
export async function saveGarment(g:Garment){return (await database()).put('garments',g)}
export async function getGarments(){return (await database()).getAll('garments')}
export async function deleteGarment(id:string){return (await database()).delete('garments',id)}
export async function saveOutfit(o:Outfit){return (await database()).put(o.status==='DRAFT'?'drafts':'outfits',o)}
export async function getOutfits(){const db=await database();return [...await db.getAll('outfits'),...await db.getAll('drafts')].sort((a,b)=>b.localDate.localeCompare(a.localDate)||b.createdAt.localeCompare(a.createdAt))}
export async function deleteOutfit(id:string){const db=await database();await db.delete('outfits',id);await db.delete('drafts',id)}
export async function clearAll(){const db=await database();const tx=db.transaction(['garments','outfits','drafts','settings','media'],'readwrite');await Promise.all([tx.objectStore('garments').clear(),tx.objectStore('outfits').clear(),tx.objectStore('drafts').clear(),tx.objectStore('settings').clear(),tx.objectStore('media').clear(),tx.done])}
export async function exportMetadata(){const garments=(await getGarments()).map(g=>({...g,photoDataUrl:undefined,hadImage:Boolean(g.photoDataUrl)}));const outfits=(await getOutfits()).map(({fullPhotoDataUrl,...o})=>({...o,items:o.items.map(i=>({garmentId:i.garmentId,name:i.name,category:i.category,color:i.color})),hadImage:Boolean(fullPhotoDataUrl)}));return {app:'angyeopchyeo',exportVersion:1,exportedAt:new Date().toISOString(),containsImages:false,garments,outfits}}
