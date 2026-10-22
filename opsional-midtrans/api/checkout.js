// POST /api/checkout  {plan_id}  (header: Authorization: Bearer <token Supabase>)
// Membuat pesanan + token Midtrans Snap. Harga SELALU diambil dari database, bukan dari browser.
import crypto from 'node:crypto'
import {basic, checkEnv, db, send, siteUrl, snapUrl, userFromReq} from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, {error: 'Method not allowed'})
  const miss = checkEnv()
  if (miss.length) return send(res, 500, {error: 'Server belum dikonfigurasi: ' + miss.join(', ')})
  const sb = db()
  const user = await userFromReq(sb, req)
  if (!user) return send(res, 401, {error: 'Silakan masuk terlebih dahulu'})
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const {data: plan} = await sb.from('plans').select('*').eq('id', body.plan_id).eq('active', true).maybeSingle()
  if (!plan) return send(res, 404, {error: 'Paket tidak ditemukan'})
  const amount = Math.round(Number(plan.price))
  if (!(amount >= 1000)) return send(res, 400, {error: 'Harga paket belum valid (minimal Rp 1.000). Hubungi admin.'})

  const {data: cur} = await sb.from('subscriptions').select('is_lifetime').eq('user_id', user.id).maybeSingle()
  if (cur?.is_lifetime) return send(res, 400, {error: 'Akun kamu sudah Lifetime, tidak perlu membeli lagi.'})

  const orderId = `PF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
  const name = (user.user_metadata?.full_name || user.email || 'Pelanggan').slice(0, 50)
  const payload = {
    transaction_details: {order_id: orderId, gross_amount: amount},
    item_details: [{id: String(plan.code || plan.id).slice(0, 50), price: amount, quantity: 1, name: ('Langganan ' + plan.name).slice(0, 50)}],
    customer_details: {first_name: name, email: user.email},
    callbacks: {finish: siteUrl(req) + '/app/billing'},
    expiry: {unit: 'hours', duration: 24}
  }
  const r = await fetch(snapUrl(), {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json', Authorization: basic()}, body: JSON.stringify(payload)})
  const m = await r.json().catch(() => ({}))
  if (!r.ok || !m.token) return send(res, 502, {error: 'Midtrans menolak permintaan: ' + (m.error_messages?.join(', ') || r.status)})

  const {error} = await sb.from('orders').insert({order_id: orderId, user_id: user.id, plan_id: plan.id, plan_name: plan.name, amount, status: 'pending', snap_token: m.token, redirect_url: m.redirect_url})
  if (error) return send(res, 500, {error: error.message})
  return send(res, 200, {order_id: orderId, token: m.token, redirect_url: m.redirect_url})
}
