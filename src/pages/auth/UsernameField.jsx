// Kolom username polos (tanpa tulisan alamat website)
export default function UsernameField({value,onChange,autoFocus=false}){
  return(<input className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#111]" placeholder="Username" required maxLength={30} value={value} onChange={onChange} autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus={autoFocus} aria-label="Username"/>)
}
