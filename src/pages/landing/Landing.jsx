import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Check, Image as Img, Link2, Menu, MessageCircle, Minus, Palette, Plus, QrCode, Rocket, Search, ShieldCheck, Smartphone, Sparkles, UserPlus, CreditCard, X, Mail, Zap } from 'lucide-react'
import Reveal from '../../components/public/Reveal'
import PlanCard from '../../components/shared/PlanCard'
import PayMethods from '../../components/shared/PayMethods'
import MiniSite from './MiniSite'
import Feedback from './Feedback'
import { usePlans } from '../../lib/plans'
import { useAccount } from '../../lib/account'
import { waLink } from '../../lib/format'
import { siteHost } from '../../lib/site'

const V = { '--ac': '#e2561b', '--bg': '#f3f1ec', '--card': '#fff', '--tx': '#111', '--dk': '#111', '--dkt': '#fff' }

const FEATURES = [
  [Zap, 'Jadi dalam 10 menit', 'Isi formulir di dashboard, upload foto dan karya. Tanpa coding, tanpa ribet atur hosting.'],
  [Link2, 'Link pribadi yang rapi', 'Dapatkan alamat portofolio atas namamu, mudah dibagikan di CV, LinkedIn, dan WhatsApp.'],
  [Palette, 'Tampilan bisa kamu atur', 'Ganti warna aksen, latar, kartu, dan menu sampai cocok dengan kepribadianmu.'],
  [Img, 'Proyek, galeri & sertifikat', 'Tampilkan karya dengan galeri foto, tautan proyek, GitHub, dan sertifikat lengkap.'],
  [Mail, 'Pesan masuk ke dashboard', 'HRD atau klien bisa langsung menghubungimu lewat formulir kontak di portofolio.'],
  [Search, 'SEO & pratinjau saat dibagikan', 'Judul, deskripsi, dan gambar pratinjau diatur sendiri agar tampil menarik di Google dan media sosial.'],
  [Smartphone, 'Nyaman di HP & laptop', 'Desain responsif dengan animasi halus, tetap ringan dibuka dari mana saja.'],
  [ShieldCheck, 'Data aman', 'Hanya kamu yang bisa mengubah isi portofolio. Bukti pembayaran disimpan privat.']
]

const STEPS = [
  [UserPlus, 'Daftar akun', 'Buat akun dan pilih username untuk link portofoliomu.'],
  [CreditCard, 'Pilih paket & bayar', 'Bayar lewat QRIS, e-wallet, atau transfer bank, lalu upload bukti. Aktif setelah diverifikasi.'],
  [Rocket, 'Isi & publikasikan', 'Lengkapi profil, proyek, dan skill. Bagikan linknya ke mana saja.']
]

const SAMPLES = [
  ['#e2561b', '#e9e8e4', 'Nadia Putri', 'UI/UX Designer', 'nadia'],
  ['#0f9d75', '#e6efe9', 'Raka Pratama', 'Data Analyst', 'raka'],
  ['#4f46e5', '#e8e8f4', 'Salsa Amelia', 'Content Strategist', 'salsa']
]

const getFaq = (app) => [
  ['Apakah harus bisa coding?', 'Tidak. Semua diatur lewat dashboard dengan formulir sederhana: isi teks, upload foto, lalu simpan. Perubahan langsung tampil.'],
  ['Metode pembayaran apa saja yang tersedia?', 'QRIS, e-wallet, dan transfer bank. Metode yang tersedia ditampilkan di bagian Pembayaran dan saat checkout.'],
  ['Kapan langgananku aktif?', `Setelah kamu membayar dan mengunggah bukti, kami verifikasi (${app.verify_time}). Langganan langsung aktif begitu disetujui.`],
  ['Apa yang terjadi kalau langganan habis?', 'Portofolio disembunyikan sementara dan kamu tidak bisa mengedit. Semua datamu tetap aman. Perpanjang kapan saja, masa aktif akan ditambahkan.'],
  ['Bisa perpanjang sebelum habis?', 'Bisa. Membeli paket lagi akan menambah masa aktif dari tanggal berakhir yang sekarang, jadi tidak ada yang terbuang.'],
  ['Bagaimana dengan paket Lifetime?', 'Bayar sekali dan portofoliomu aktif selama layanan ini berjalan, tanpa biaya perpanjangan.'],
  ['Ada pertanyaan lain?', 'Hubungi kami lewat WhatsApp atau email yang tertera di bagian bawah halaman.']
]

export default function Landing() {
  const nav = useNavigate(),
    { user, access, profile } = useAccount(),
    { plans, app, live, loading, methods } = usePlans()

  const faqData = getFaq(app)

  const [open, setOpen] = useState(false),
    [sc, setSc] = useState(false),
    [faq, setFaq] = useState(0)

  useEffect(() => {
    document.title = `${app.brand_name} | ${app.tagline}`
    const f = () => setSc(scrollY > 20)
    f()
    addEventListener('scroll', f)
    return () => removeEventListener('scroll', f)
  }, [app])

  const pick = p => nav(user ? `/app/billing?plan=${p.code || p.id}` : `/daftar?plan=${p.code || p.id}`)

  const links = [
    ['fitur', 'Fitur'],
    ['contoh', 'Contoh'],
    ['harga', 'Harga'],
    ['pembayaran', 'Pembayaran'],
    ['faq', 'FAQ']
  ]

  const wa = waLink(app.support_whatsapp)

  const cta = user
    ? <Link to="/app" className="rounded-full bg-[#111] px-5 py-2.5 text-sm font-medium text-white">Buka dashboard</Link>
    : <>
      <Link to="/masuk" className="hidden rounded-full px-4 py-2.5 text-sm font-medium hover:bg-black/5 sm:block">Masuk</Link>
      <Link to="/daftar" className="rounded-full bg-[#111] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#e2561b]">Daftar</Link>
    </>

  return (
    <div style={V} className="min-h-screen bg-[var(--bg)] text-[#111]">

      {app.announcement &&
        <div className="bg-[#111] px-4 py-2 text-center text-xs font-medium text-white">
          {app.announcement}
        </div>
      }

      <header className={`sticky top-0 z-40 transition ${sc || open ? 'border-b border-black/10 bg-[var(--bg)]/85 backdrop-blur-md' : ''}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">

          <Link to="/" className="font-display flex items-center gap-2 text-lg font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#111] text-xs text-white">
              {app.brand_name.slice(0, 2)}
            </span>
            {app.brand_name}
          </Link>

          <nav className="hidden gap-1 md:flex">
            {links.map(([id, l]) =>
              <a
                key={id}
                href={'#' + id}
                className="rounded-full px-4 py-2 text-sm font-medium text-black/70 transition hover:bg-black/5 hover:text-black"
              >
                {l}
              </a>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {cta}

            <button
              className="grid h-10 w-10 place-items-center md:hidden"
              onClick={() => setOpen(!open)}
              aria-label="Menu"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

        </div>

        <AnimatePresence>
          {open &&
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-2 px-5 pb-5 md:hidden"
            >
              {links.map(([id, l]) =>
                <a
                  key={id}
                  href={'#' + id}
                  onClick={() => setOpen(false)}
                  className="font-display rounded-2xl bg-white px-5 py-3.5 text-lg font-medium"
                >
                  {l}
                </a>
              )}

              {!user &&
                <Link
                  to="/masuk"
                  className="font-display rounded-2xl bg-white px-5 py-3.5 text-lg font-medium"
                >
                  Masuk
                </Link>
              }
            </motion.nav>
          }
        </AnimatePresence>
      </header>


      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#e2561b]/15 blur-3xl" />

        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 md:grid-cols-12 md:pt-20">

          <div className="md:col-span-6">

            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/70 px-3.5 py-1.5 text-xs font-semibold">
                <Sparkles size={13} className="text-[#e2561b]" />
                Untuk mahasiswa, fresh graduate & profesional
              </span>
            </Reveal>

            <Reveal delay={.08}>
              <h1 className="font-display mt-6 text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                {app.hero_title}
              </h1>
            </Reveal>

            <Reveal delay={.16}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-black/65 md:text-lg">
                {app.hero_subtitle}
              </p>
            </Reveal>

            <Reveal delay={.24}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href="#harga"
                  className="inline-flex items-center gap-2 rounded-full bg-[#111] px-7 py-3.5 text-sm font-semibold text-white transition-all hover:gap-3 hover:bg-[#e2561b]"
                >
                  Lihat paket & harga
                  <ArrowUpRight size={16} />
                </a>

                <Link
                  to="/demo"
                  className="rounded-full border border-black/20 px-7 py-3.5 text-sm font-semibold transition hover:bg-[#111] hover:text-white"
                >
                  Lihat contoh portofolio
                </Link>
              </div>
            </Reveal>

            <Reveal delay={.32}>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-black/60">
                {['Bayar pakai QRIS', 'E-wallet & transfer bank', 'Tanpa coding'].map(t =>
                  <li key={t} className="flex items-center gap-1.5">
                    <Check size={16} className="text-[#e2561b]" />
                    {t}
                  </li>
                )}
              </ul>
            </Reveal>

          </div>

          <Reveal delay={.15} className="relative md:col-span-6">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <MiniSite
                url={`${siteHost()}/u/nadia`}
                scale={1.15}
              />
            </motion.div>

            <div className="absolute -left-4 top-1/3 hidden items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold shadow-xl sm:flex">
              <QrCode size={16} className="text-[#e2561b]" />
              Bayar via QRIS
            </div>

            <div className="absolute -bottom-4 right-4 hidden items-center gap-2 rounded-2xl bg-[#111] px-4 py-2.5 text-sm font-semibold text-white shadow-xl sm:flex">
              <Check size={16} className="text-emerald-400" />
              Langganan aktif
            </div>
          </Reveal>

        </div>
      </section>


      {/* FITUR */}
      <section id="fitur" className="scroll-mt-16 py-20">
        <div className="mx-auto max-w-6xl px-5">

          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#e2561b]">
              Fitur
            </p>

            <h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
              Semua yang kamu butuhkan untuk tampil profesional
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(([I, t, d], i) =>
              <Reveal key={t} delay={(i % 4) * .06} className="h-full">
                <div className="h-full rounded-3xl border border-black/10 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e2561b]/10 text-[#e2561b]">
                    <I size={21} />
                  </span>

                  <h3 className="font-display mt-4 font-semibold">{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-black/60">{d}</p>
                </div>
              </Reveal>
            )}
          </div>

        </div>
      </section>


      {/* CARA KERJA */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="rounded-[2.5rem] bg-[#111] p-8 text-white md:p-14">

            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#ff8a5c]">
                Cara kerja
              </p>

              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Tiga langkah, portofolio online
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {STEPS.map(([I, t, d], i) =>
                <Reveal key={t} delay={i * .08}>
                  <div className="relative h-full rounded-3xl border border-white/10 bg-white/5 p-7">
                    <span className="font-display absolute right-6 top-5 text-5xl font-semibold text-white/10">
                      {i + 1}
                    </span>

                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e2561b]">
                      <I size={20} />
                    </span>

                    <h3 className="font-display mt-5 text-lg font-semibold">{t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{d}</p>
                  </div>
                </Reveal>
              )}
            </div>

          </div>
        </div>
      </section>


      {/* CONTOH */}
      <section id="contoh" className="scroll-mt-16 py-20">
        <div className="mx-auto max-w-6xl px-5">

          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#e2561b]">
              Contoh portofolio
            </p>

            <h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
              Satu template, warna sesukamu
            </h2>

            <p className="mt-4 max-w-xl text-black/60">
              Tiga contoh di bawah memakai template yang sama dengan warna berbeda. Buka demo lengkap untuk mencoba sendiri, termasuk ganti warna secara langsung.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {SAMPLES.map(([ac, bg, n, r, u], i) =>
              <Reveal key={u} delay={i * .08}>
                <Link to={`/demo?warna=${i}`} className="group block">
                  <div className="transition duration-300 group-hover:-translate-y-2">
                    <MiniSite
                      ac={ac}
                      bg={bg}
                      name={n}
                      role={r}
                      url={`${siteHost()}/u/${u}`}
                    />
                  </div>

                  <p className="mt-4 flex items-center justify-between text-sm font-semibold">
                    {n}

                    <span className="flex items-center gap-1 text-[#e2561b]">
                      Buka demo
                      <ArrowUpRight size={15} />
                    </span>
                  </p>
                </Link>
              </Reveal>
            )}
          </div>

          <Reveal>
            <div className="mt-10 flex flex-wrap items-center gap-3">

              <Link
                to="/demo"
                className="inline-flex items-center gap-2 rounded-full bg-[#111] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#e2561b]"
              >
                Buka demo lengkap
                <ArrowUpRight size={16} />
              </Link>

              {app.sample_username &&
                <Link
                  to={`/u/${app.sample_username}`}
                  className="rounded-full border border-black/20 px-7 py-3.5 text-sm font-semibold transition hover:bg-[#111] hover:text-white"
                >
                  Lihat portofolio nyata
                </Link>
              }

            </div>
          </Reveal>

        </div>
      </section>


      {/* HARGA */}
      <section id="harga" className="scroll-mt-16 py-20">
        <div className="mx-auto max-w-6xl px-5">

          <Reveal>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#e2561b]">
                Harga
              </p>

              <h2 className="font-display mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
                Pilih paket yang pas, bayar sekali per periode
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-black/60">
                Tanpa biaya tersembunyi. Semua paket mendapat fitur lengkap, bedanya hanya lama aktif.
              </p>
            </div>
          </Reveal>

          {loading
            ? <p className="mt-12 text-center text-sm text-black/40">Memuat paket…</p>
            : <div className={`mx-auto mt-14 grid items-stretch gap-6 ${plans.length >= 3 ? 'md:grid-cols-3' : plans.length === 2 ? 'max-w-3xl md:grid-cols-2' : 'max-w-sm'}`}>
              {plans.map((p, i) =>
                <Reveal key={p.id} delay={i * .08} className="h-full">
                  <PlanCard
                    plan={p}
                    onSelect={pick}
                    cta={user && access ? 'Perpanjang / beli paket' : 'Mulai sekarang'}
                    note="QRIS, e-wallet, transfer bank"
                  />
                </Reveal>
              )}
            </div>
          }

          {!live && !loading &&
            <p className="mt-6 text-center text-xs text-black/40">
              Harga di atas contoh bawaan. Owner dapat mengubahnya di menu Owner &gt; Paket.
            </p>
          }

        </div>
      </section>


      {/* PEMBAYARAN */}
      <section id="pembayaran" className="scroll-mt-16 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="rounded-[2.5rem] bg-[#111] p-8 text-white md:p-14">

            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#ff8a5c]">
                Metode pembayaran
              </p>

              <h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
                Bayar dengan cara yang paling nyaman buatmu
              </h2>

              <p className="mt-4 max-w-2xl text-white/60">
                Pilih paket, bayar sesuai nominal lewat QRIS, e-wallet, atau transfer bank, lalu unggah bukti. Langganan aktif setelah diverifikasi.
              </p>
            </Reveal>

            <div className="mt-10">
              <PayMethods
                dark
                methods={methods}
                verify={app.verify_time}
              />
            </div>

            <Reveal>
              <div className="mt-8 grid gap-3 text-sm text-white/65 md:grid-cols-3">

                {[
                  [
                    '1. Bayar sesuai nominal',
                    'Total sudah termasuk 3 digit kode unik supaya pembayaranmu mudah kami kenali. Transfer harus tepat.'
                  ],
                  [
                    '2. Upload bukti bayar',
                    'Unggah screenshot atau foto bukti langsung di dashboard, tanpa perlu chat panjang.'
                  ],
                  [
                    '3. Aktif setelah verifikasi',
                    'Kami cek pembayaranmu (' + app.verify_time + '), lalu langganan aktif dan portofolio tampil.'
                  ]
                ].map(([t, d]) =>
                  <div key={t} className="rounded-2xl border border-white/10 p-5">
                    <p className="font-semibold text-white">{t}</p>
                    <p className="mt-1">{d}</p>
                  </div>
                )}

              </div>
            </Reveal>

          </div>
        </div>
      </section>


      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 py-20">
        <div className="mx-auto max-w-3xl px-5">

          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#e2561b]">
              FAQ
            </p>

            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Pertanyaan yang sering muncul
            </h2>
          </Reveal>

          <div className="mt-10 divide-y divide-black/10 rounded-3xl border border-black/10 bg-white">

            {faqData.map(([q, a], i) =>
              <div key={q}>

                <button
                  onClick={() => setFaq(faq === i ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold"
                >
                  <span>{q}</span>

                  {faq === i
                    ? <Minus size={18} className="flex-none text-[#e2561b]" />
                    : <Plus size={18} className="flex-none" />
                  }
                </button>

                <AnimatePresence initial={false}>
                  {faq === i &&
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed text-black/65">
                        {a}
                      </p>
                    </motion.div>
                  }
                </AnimatePresence>

              </div>
            )}

          </div>

        </div>
      </section>


      <Feedback />

      {/* CTA */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-6xl rounded-[2.5rem] bg-[#e2561b] p-10 text-center text-white md:p-16">

          <h2 className="font-display mx-auto max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
            Saatnya karyamu dilihat lebih banyak orang.
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Buat portofolio onlinemu sekarang dan bagikan linknya hari ini juga.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">

            <a
              href="#harga"
              className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#111] transition hover:bg-[#111] hover:text-white"
            >
              Pilih paket
            </a>

            <Link
              to="/demo"
              className="rounded-full border border-white/50 px-8 py-3.5 text-sm font-semibold transition hover:bg-white/10"
            >
              Lihat contoh
            </Link>

          </div>

        </div>
      </section>


      <footer className="border-t border-black/10 px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 text-sm text-black/55 md:flex-row">

          <p>
            © {new Date().getFullYear()} {app.brand_name}. Hak cipta dilindungi.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">

            <Link to="/syarat" className="hover:text-black">
              Syarat & Kebijakan
            </Link>

            <Link to="/privasi" className="hover:text-black">
              Privasi
            </Link>

            <a href="#masukan" className="hover:text-black">
              Saran & Masukan
            </a>

            {wa &&
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-black"
              >
                <MessageCircle size={15} />
                WhatsApp
              </a>
            }

            {app.support_email &&
              <a
                href={'mailto:' + app.support_email}
                className="flex items-center gap-1.5 hover:text-black"
              >
                <Mail size={15} />
                {app.support_email}
              </a>
            }

          </div>

        </div>
      </footer>

    </div>
  )
}