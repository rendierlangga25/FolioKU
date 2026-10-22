// POST /api/notify  -> Payment Notification (webhook) dari Midtrans.
// Daftarkan URL ini di Midtrans Dashboard > Settings > Payment > Notification URL.
import {checkEnv, db, send, syncOrder, verifySignature} from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, {error: 'Method not allowed'})
  if (checkEnv().length) return send(res, 500, {error: 'Server belum dikonfigurasi'})
  const n = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  if (!n.order_id || !verifySignature(n)) return send(res, 403, {error: 'Signature tidak valid'})
  // status diverifikasi ulang langsung ke API Midtrans (bukan percaya isi notifikasi)
  const r = await syncOrder(db(), n.order_id)
  if (r.error && r.code !== 404) return send(res, r.code || 400, {error: r.error})
  return send(res, 200, {ok: true})
}
