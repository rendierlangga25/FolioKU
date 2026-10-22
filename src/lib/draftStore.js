// Draft perjalanan disimpan di PERANGKAT driver (IndexedDB) — termasuk foto —
// dan baru dikirim ke database setelah semua data wajib lengkap.
// Dikunci per user supaya akun lain di HP yang sama tidak melihat draft ini.

const DB_NAME = 'raxer_drafts';
const STORE = 'drafts';
let dbPromise;

const open = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('Penyimpanan draft tidak didukung browser ini'));
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('Gagal membuka penyimpanan draft'));
    });
    dbPromise.catch(() => { dbPromise = undefined; });
  }
  return dbPromise;
};

const run = async (mode, fn) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaksi draft dibatalkan'));
  });
};

export const drafts = {
  async list(uid) {
    const all = (await run('readonly', (s) => s.getAll())) || [];
    return all.filter((d) => d.uid === uid).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get: (id) => run('readonly', (s) => s.get(id)),
  put: (draft) => run('readwrite', (s) => s.put(draft)),
  remove: (id) => run('readwrite', (s) => s.delete(id)),
};
