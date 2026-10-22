// Satu foto di form: { id, blob?, path?, url }.
//  blob = foto baru di perangkat (belum diunggah) · path = file yang sudah ada di storage.
let n = 0;
export const mkItem = (blob) => ({ id: `p${Date.now()}-${n++}`, blob, url: URL.createObjectURL(blob) });
export const pathItem = (path) => (path ? { id: `s${n++}`, path, url: null } : null);
export const dropItem = (it) => { if (it?.blob && it.url?.startsWith('blob:')) URL.revokeObjectURL(it.url); };
