// Apakah URL file berupa PDF (berdasarkan nama file di akhir URL)
export const isPdf=u=>{try{return /\.pdf$/i.test(new URL(u,'http://x').pathname)}catch{return /\.pdf($|\?|#)/i.test(u||'')}}
