// src/lib/claimDraft.ts
//
// Lets a client stop partway through logging a claim and pick up where they
// left off later — on the same device/browser. Drafts (including any photos
// or voice notes already attached) are stored in IndexedDB, since it can
// hold File/Blob objects directly, unlike localStorage.
//
// Drafts expire automatically after DRAFT_TTL_MS so old, stale attachments
// don't linger forever if someone never comes back to finish.

const DB_NAME = 'claims_made_easy_drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ClaimDraftRecord {
  key: string;
  claimType: string;
  savedAt: number;
  data: Record<string, unknown>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available in this browser'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Builds a stable draft key for a claim-in-progress.
 * Scoped to claim type + client (or, if the client isn't authenticated yet,
 * a per-browser anonymous ID) so different claim types / different people
 * on the same device never collide.
 */
export function buildDraftKey(claimType: string, clientId?: string | null): string {
  if (clientId) return `${claimType}:${clientId}`;
  return `${claimType}:anon:${getAnonId()}`;
}

function getAnonId(): string {
  const STORAGE_KEY = 'cme_anon_draft_id';
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

export async function saveClaimDraft(
  key: string,
  claimType: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const db = await openDb();
    const record: ClaimDraftRecord = { key, claimType, savedAt: Date.now(), data };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    // Autosave failing should never break the claim flow itself
    console.warn('Draft autosave failed:', err);
  }
}

export async function loadClaimDraft(key: string): Promise<ClaimDraftRecord | null> {
  try {
    const db = await openDb();
    const record = await new Promise<ClaimDraftRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (!record) return null;

    if (Date.now() - record.savedAt > DRAFT_TTL_MS) {
      await clearClaimDraft(key);
      return null;
    }

    return record;
  } catch (err) {
    console.warn('Draft load failed:', err);
    return null;
  }
}

export async function clearClaimDraft(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Draft clear failed:', err);
  }
}
