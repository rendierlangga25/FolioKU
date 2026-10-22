// GET /api/order-status?order_id=...  -> sinkronkan status pesanan milik pengguna dari Midtrans
import {checkEnv, db, send, syncOrder, userFromReq} from './_lib.js'

export default async function handler(req, res) {
  const miss = checkEnv()
  if (miss.length) return send(res, 500, {error: 'Server belum dikonfigurasi: ' + miss.join(', ')})
  const sb = db()
  const user = await userFromReq(sb, req)
  if (!user) return send(res, 401, {error: 'Silakan masuk terlebih dahulu'})
  const id = String(req.query.order_id || '')
  const {data: o} = await sb.from('orders').select('user_id').eq('order_id', id).maybeSingle()
  if (!o || o.user_id !== user.id) return send(res, 404, {error: 'Pesanan tidak ditemukan'})
  const r = await syncOrder(sb, id)
  if (r.error) return send(res, r.code || 400, {error: r.error})
  return send(res, 200, {status: r.status})
}
