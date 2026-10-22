// Aturan kelengkapan input perjalanan — dipakai form (validasi), daftar draft (progres) dan tes.
//
// Draft boleh disimpan setengah jadi. Data baru masuk database setelah SEMUA wajib terisi.
// Tol & parkir bersifat opsional: tidak menahan pengiriman data.

export const normTujuan = (s) => String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();

export const EMPTY_FORM = {
  driver1_id: '', driver2_id: '', vehicle_id: '', tujuan: [''],
  bbm_rp: '', tol_rp: '', parkir_rp: '', parkir_cash_rp: '', kuli_bongkar_rp: '', security_rp: '', kartu4: '',
  km_awal: '', km_isi: '', km_akhir: '',
  kendala_ket: '',
};

export const EMPTY_PHOTOS = () => ({ km_awal: null, km_isi: null, km_akhir: null, serah_terima: [], surat_jalan: [], kendala: [], sisa_bbm: [] });

const has = (v) => v !== '' && v != null;

/**
 * @param f      isi form
 * @param ph     foto: { km_awal, km_isi, km_akhir, serah_terima[], surat_jalan[], kendala[], sisa_bbm[] } (item atau null; sisa_bbm opsional)
 * @param opts   { harga, relaxPhotos } — relaxPhotos: owner mengubah data lama, foto baru tidak diwajibkan
 * @returns { problems: string[], steps: {key,label,ok}[], complete: boolean }
 */
export function checkTrip(f, ph, { harga = 1, relaxPhotos = false } = {}) {
  const problems = [];
  const photoOk = (cond) => relaxPhotos || cond;
  const add = (cond, msg) => { if (!cond) problems.push(msg); };

  const kruOk = Boolean(f.driver1_id) && Boolean(f.vehicle_id) && !(f.driver2_id && f.driver2_id === f.driver1_id);
  add(f.driver1_id, 'Pilih Driver 1');
  add(!(f.driver2_id && f.driver2_id === f.driver1_id), 'Driver 2 tidak boleh sama dengan Driver 1');
  add(f.vehicle_id, 'Pilih mobil');

  const filled = (f.tujuan || []).filter((t) => t.trim());
  const tujuanOk = filled.length > 0 && filled.length === (f.tujuan || []).length;
  add(filled.length > 0, 'Isi minimal satu tujuan');
  add(!(filled.length > 0 && filled.length < f.tujuan.length), 'Ada kolom tujuan yang kosong — isi atau hapus');

  const bbmOk = +f.bbm_rp > 0 && /^\d{4}$/.test(f.kartu4);
  add(+f.bbm_rp > 0, 'Nominal BBM wajib diisi');
  add(/^\d{4}$/.test(f.kartu4), 'Nomor kartu harus 4 digit angka');

  const awalOk = has(f.km_awal) && photoOk(Boolean(ph.km_awal));
  add(photoOk(Boolean(ph.km_awal)), 'Foto KM awal wajib diupload');
  add(has(f.km_awal), 'KM awal wajib diisi');

  const isiOk = has(f.km_isi) && photoOk(Boolean(ph.km_isi));
  add(photoOk(Boolean(ph.km_isi)), 'Foto KM saat isi BBM wajib diupload');
  add(has(f.km_isi), 'KM saat isi BBM wajib diisi');

  const akhirOk = has(f.km_akhir) && photoOk(Boolean(ph.km_akhir));
  add(photoOk(Boolean(ph.km_akhir)), 'Foto KM akhir wajib diupload');
  add(has(f.km_akhir), 'KM akhir wajib diisi');

  const urut = !(has(f.km_awal) && has(f.km_isi) && +f.km_isi < +f.km_awal)
    && !(has(f.km_isi) && has(f.km_akhir) && +f.km_akhir < +f.km_isi)
    && !(has(f.km_awal) && has(f.km_akhir) && +f.km_akhir < +f.km_awal);
  add(!(has(f.km_awal) && has(f.km_isi) && +f.km_isi < +f.km_awal), 'KM saat isi BBM tidak boleh lebih kecil dari KM awal');
  add(!(has(f.km_isi) && has(f.km_akhir) && +f.km_akhir < +f.km_isi), 'KM akhir tidak boleh lebih kecil dari KM saat isi BBM');
  add(!(has(f.km_awal) && has(f.km_akhir) && +f.km_akhir < +f.km_awal), 'KM akhir tidak boleh lebih kecil dari KM awal');

  const serahOk = photoOk(ph.serah_terima.length > 0);
  add(serahOk, 'Foto bukti serah terima ke customer wajib diupload');
  const sjOk = photoOk(ph.surat_jalan.length > 0);
  add(sjOk, 'Foto surat jalan yang sudah ditandatangani wajib diupload');

  add(harga, 'Harga BBM untuk mobil ini belum diatur oleh developer');

  const steps = [
    { key: 'kru', label: 'Mobil & driver', ok: kruOk },
    { key: 'tujuan', label: 'Tujuan', ok: tujuanOk },
    { key: 'awal', label: 'KM awal', ok: awalOk && urut },
    { key: 'bbm', label: 'BBM & kartu', ok: bbmOk },
    { key: 'isi', label: 'KM isi BBM', ok: isiOk && urut },
    { key: 'akhir', label: 'KM akhir', ok: akhirOk && urut },
    { key: 'serah', label: 'Serah terima', ok: serahOk },
    { key: 'sj', label: 'Surat jalan', ok: sjOk },
  ];
  return { problems, steps, complete: problems.length === 0 };
}
