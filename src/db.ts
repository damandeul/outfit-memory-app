import { openDB, type DBSchema } from 'idb';
import type { Garment, Outfit } from './types';

interface Schema extends DBSchema {
  garments: { key: string; value: Garment };
  outfits: { key: string; value: Outfit };
  drafts: { key: string; value: Outfit };
  settings: { key: string; value: unknown };
  media: { key: string; value: Blob };
}

const database = () =>
  openDB<Schema>('angyeopchyeo', 1, {
    upgrade(db) {
      db.createObjectStore('garments', { keyPath: 'id' });
      db.createObjectStore('outfits', { keyPath: 'id' });
      db.createObjectStore('drafts', { keyPath: 'id' });
      db.createObjectStore('settings');
      db.createObjectStore('media');
    },
  });

export async function saveGarment(garment: Garment) {
  return (await database()).put('garments', garment);
}

export async function getGarments() {
  return (await database()).getAll('garments');
}

export async function deleteGarment(id: string) {
  const db = await database();
  const garment = await db.get('garments', id);
  if (!garment) return undefined;
  const deletedAt = new Date().toISOString();
  return db.put('garments', {
    ...garment,
    status: 'ARCHIVED',
    deletedAt,
    updatedAt: deletedAt,
  });
}

export async function saveOutfit(outfit: Outfit) {
  const db = await database();
  const target = outfit.status === 'DRAFT' ? 'drafts' : 'outfits';
  const other = outfit.status === 'DRAFT' ? 'outfits' : 'drafts';
  const transaction = db.transaction([target, other], 'readwrite');
  await Promise.all([
    transaction.objectStore(target).put(outfit),
    transaction.objectStore(other).delete(outfit.id),
    transaction.done,
  ]);
  return outfit.id;
}

export async function getOutfits() {
  const db = await database();
  return [...(await db.getAll('outfits')), ...(await db.getAll('drafts'))].sort(
    (a, b) =>
      b.localDate.localeCompare(a.localDate) || b.createdAt.localeCompare(a.createdAt),
  );
}

export async function deleteOutfit(id: string) {
  const db = await database();
  const transaction = db.transaction(['outfits', 'drafts'], 'readwrite');
  await Promise.all([
    transaction.objectStore('outfits').delete(id),
    transaction.objectStore('drafts').delete(id),
    transaction.done,
  ]);
}

export async function clearAll() {
  const db = await database();
  const transaction = db.transaction(
    ['garments', 'outfits', 'drafts', 'settings', 'media'],
    'readwrite',
  );
  await Promise.all([
    transaction.objectStore('garments').clear(),
    transaction.objectStore('outfits').clear(),
    transaction.objectStore('drafts').clear(),
    transaction.objectStore('settings').clear(),
    transaction.objectStore('media').clear(),
    transaction.done,
  ]);
}

export async function exportMetadata() {
  const garments = (await getGarments()).map((garment) => ({
    ...garment,
    photoDataUrl: undefined,
    hadImage: Boolean(garment.photoDataUrl),
  }));
  const outfits = (await getOutfits()).map(({ fullPhotoDataUrl, ...outfit }) => ({
    ...outfit,
    items: outfit.items.map((item) => ({
      garmentId: item.garmentId,
      name: item.name,
      category: item.category,
      color: item.color,
    })),
    hadImage: Boolean(fullPhotoDataUrl),
  }));
  return {
    app: 'angyeopchyeo',
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    containsImages: false,
    garments,
    outfits,
  };
}
