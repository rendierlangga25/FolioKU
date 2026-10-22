// Helper bersama untuk fungsi server (Vercel Serverless Functions).
import {createClient} from '@supabase/supabase-js'
import crypto from 'node:crypto'

export const isProd = () => String(process.env.MIDTRANS_IS_PRODUCTION).toLowerCase() === 'true'
export const snapUrl = () => (isProd() ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com') + '/snap/v1/transactions'
export const statusUrl = id => (isProd() ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com') + '/v2/' + encodeURIComponent(id) + '/status'
export const basic = () => 'Basic ' + Buffer.from((process.env.MIDTRANS_SERVER_KEY || '') + ':').toString('base64')

export const db = () => createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {auth: {persistSession: false, autoRefreshToken: false}})

export const siteUrl = req => (process.env.SITE_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '')

export function send(res, code, body) { res.status(code).setHeader('Content-Type', 'application/json'); res.send(JSON.stringify(body)) }

export function checkEnv() {
  const miss = ['MIDTRANS_SERVER_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter(k => !process.env[k])
  if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) miss.push('SUPABASE_URL')
  return miss
}

export async function userFromReq(sb, req) {
  const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!tok) return null
  const {data, error} = await sb.auth.getUser(tok)
  return error ? null : data.user
}

export function mapStatus(m) {
  const s = m.transaction_status, f = m.fraud_status
  if (s === 'settlement' || (s === 'capture' && (!f || f === 'accept'))) return 'paid'
  if (s === 'pending') return 'pending'
  if (s === 'expire') return 'expired'
  if (s === 'refund' || s === 'partial_refund' || s === 'chargeback') return 'refunded'
  if (s === 'deny' || s === 'cancel' || s === 'failure') return 'failed'
  return 'pending'
}

// Ambil status terbaru dari Midtrans lalu terapkan ke database (idempotent).
export async function syncOrder(sb, orderId) {
  const {data: order} = await sb.from('orders').select('*').eq('order_id', orderId).maybeSingle()
  if (!order) return {error: 'Pesanan tidak ditemukan', code: 404}
  const r = await fetch(statusUrl(orderId), {headers: {Accept: 'application/json', Authorization: basic()}})
  const m = await r.json().catch(() => ({}))
  if (!m || m.status_code === '404') return {order, status: order.status}   // belum ada transaksi (belum memilih metode bayar)
  if (m.gross_amount && Math.round(Number(m.gross_amount)) !== Number(order.amount)) return {error: 'Nominal tidak cocok', code: 400}
  const status = mapStatus(m)
  if (status === 'paid') {
    // hanya satu proses yang berhasil mengubah ke 'paid' -> langganan diberikan tepat satu kali
    const {data: upd} = await sb.from('orders').update({status: 'paid', payment_type: m.payment_type || order.payment_type, paid_at: new Date().toISOString()})
      .eq('order_id', orderId).neq('status', 'paid').select().maybeSingle()
    if (upd) await grant(sb, order)
  } else if (order.status !== 'paid') {
    await sb.from('orders').update({status, payment_type: m.payment_type || order.payment_type}).eq('order_id', orderId)
  } else if (status === 'refunded') {
    await sb.from('orders').update({status}).eq('order_id', orderId)
  }
  return {status: order.status === 'paid' && status !== 'refunded' ? 'paid' : status}
}

async function grant(sb, order) {
  const {data: plan} = await sb.from('plans').select('*').eq('id', order.plan_id).maybeSingle()
  const {data: cur} = await sb.from('subscriptions').select('*').eq('user_id', order.user_id).maybeSingle()
  const now = new Date()
  let row
  if (!plan || plan.duration_months == null) {
    row = {user_id: order.user_id, plan_id: order.plan_id, plan_name: order.plan_name, is_lifetime: true, expires_at: null, started_at: cur?.started_at || now.toISOString()}
  } else if (cur?.is_lifetime) {
    return // sudah lifetime, tidak perlu diubah
  } else {
    const base = cur?.expires_at && new Date(cur.expires_at) > now ? new Date(cur.expires_at) : now
    const end = new Date(base); end.setMonth(end.getMonth() + plan.duration_months)
    row = {user_id: order.user_id, plan_id: order.plan_id, plan_name: order.plan_name, is_lifetime: false, expires_at: end.toISOString(), started_at: cur?.started_at || now.toISOString()}
  }
  await sb.from('subscriptions').upsert(row, {onConflict: 'user_id'})
}

export const verifySignature = n => {
  const raw = String(n.order_id) + String(n.status_code) + String(n.gross_amount) + (process.env.MIDTRANS_SERVER_KEY || '')
  const sig = crypto.createHash('sha512').update(raw).digest('hex')
  return typeof n.signature_key === 'string' && n.signature_key.length === sig.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(n.signature_key))
}
